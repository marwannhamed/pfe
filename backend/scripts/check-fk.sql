SELECT c.conname, c.confdeltype, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname IN ('spaces', 'floors', 'bookings')
  AND c.contype = 'f';

SELECT s.id, s.name, s.floor_id, f.id AS floor_exists
FROM spaces s
LEFT JOIN floors f ON f.id = s.floor_id
WHERE f.id IS NULL;
