EXPLAIN
SELECT id, title, summary, category, market, published_at
FROM collected_items
WHERE category = 'finance'
  AND market = 'us'
ORDER BY collected_at DESC
LIMIT 20;

EXPLAIN
SELECT id, title, summary, category, market, published_at
FROM collected_items
WHERE source_id = '00000000-0000-0000-0000-000000000000'
ORDER BY collected_at DESC
LIMIT 20;

EXPLAIN
SELECT id
FROM collected_items
WHERE expires_at < now()
LIMIT 100;

EXPLAIN
SELECT id, status, executed_at
FROM collector_logs
WHERE source_id = '00000000-0000-0000-0000-000000000000'
ORDER BY executed_at DESC
LIMIT 20;
