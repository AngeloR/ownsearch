import type { FastifyInstance, FastifyPluginCallback } from "fastify";

import {
  EMBEDDING_DIMENSIONS,
  RESULT_LIMIT,
  TEXT_WEIGHT,
  VECTOR_WEIGHT,
} from "../config.js";
import { pool } from "../db.js";
import { embedText, formatVectorLiteral } from "../embedding.js";
import type { SearchResponseBody, SearchResult } from "../types.js";

type SearchQuery = {
  q?: string;
  limit?: number;
};

const hybridSql = `
  WITH params AS (
    SELECT
      plainto_tsquery('english', $1) AS ts_query,
      $2::vector AS query_vec
  )
  SELECT
    d.id,
    d.url,
    d.title,
    d.metadata,
    dc.content AS chunk_content,
    ts_rank(d.search_vector, params.ts_query) AS text_score,
    1 - (dc.embedding <=> params.query_vec) AS vector_score
  FROM params
  JOIN documents d ON d.search_vector @@ params.ts_query
  JOIN document_chunks dc ON dc.document_id = d.id
  ORDER BY (
    $3 * ts_rank(d.search_vector, params.ts_query) +
    $4 * (1 - (dc.embedding <=> params.query_vec))
  ) DESC
  LIMIT $5
`;

const vectorSql = `
  SELECT
    d.id,
    d.url,
    d.title,
    d.metadata,
    dc.content AS chunk_content,
    0.0::float8 AS text_score,
    1 - (dc.embedding <=> $1::vector) AS vector_score
  FROM documents d
  JOIN document_chunks dc ON dc.document_id = d.id
  ORDER BY vector_score DESC
  LIMIT $2
`;

const searchRoutes: FastifyPluginCallback = async (fastify: FastifyInstance) => {
  fastify.get<{ Querystring: SearchQuery }>("/search", async (request, reply) => {
    const query = request.query.q?.trim();
    if (!query) {
      reply.code(400);
      return { error: "Query parameter 'q' is required." };
    }

    const limitParam = request.query.limit ?? RESULT_LIMIT;
    const limit = Math.min(Math.max(Number(limitParam) || RESULT_LIMIT, 1), RESULT_LIMIT);

    const embedding = embedText(query, EMBEDDING_DIMENSIONS);
    const vectorLiteral = formatVectorLiteral(embedding);

    const aggregated = new Map<string, SearchResult>();

    const client = await pool.connect();
    try {
      const hybridResult = await client.query(hybridSql, [
        query,
        vectorLiteral,
        TEXT_WEIGHT,
        VECTOR_WEIGHT,
        limit,
      ]);

      const upsert = (row: Record<string, unknown>, textWeight: number, vectorWeight: number) => {
        const idValue = row.id;
        if (!idValue) {
          return;
        }
        const documentId = String(idValue);

        const metadataRaw = row.metadata as unknown;
        let metadata: Record<string, unknown> | null | undefined = undefined;
        if (metadataRaw && typeof metadataRaw === "string") {
          try {
            metadata = JSON.parse(metadataRaw);
          } catch {
            metadata = undefined;
          }
        } else if (metadataRaw && typeof metadataRaw === "object") {
          metadata = metadataRaw as Record<string, unknown>;
        } else {
          metadata = null;
        }

        const textScore = Number(row.text_score ?? 0);
        const vectorScore = Number(row.vector_score ?? 0);
        const score = textWeight * textScore + vectorWeight * vectorScore;
        const snippet = String(row.chunk_content ?? "");

        const existing = aggregated.get(documentId);
        if (!existing || score > existing.score) {
          aggregated.set(documentId, {
            documentId,
            url: String(row.url ?? ""),
            title: String(row.title ?? ""),
            snippet,
            score,
            textScore,
            vectorScore,
            metadata,
          });
        }
      };

      for (const row of hybridResult.rows) {
        upsert(row as Record<string, unknown>, TEXT_WEIGHT, VECTOR_WEIGHT);
      }

      if (aggregated.size < limit) {
        const vectorResult = await client.query(vectorSql, [vectorLiteral, limit * 2]);
        for (const row of vectorResult.rows) {
          upsert(row as Record<string, unknown>, 0, VECTOR_WEIGHT);
        }
      }
    } finally {
      client.release();
    }

    const results = [...aggregated.values()].sort((a, b) => b.score - a.score).slice(0, limit);
    const payload: SearchResponseBody = { results };
    return payload;
  });
};

export default searchRoutes;
