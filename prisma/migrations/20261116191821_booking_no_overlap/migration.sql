-- Permite usar igualdade (=) de colunas comuns dentro de índices GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Uma reserva precisa terminar depois de começar
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_ends_after_starts" CHECK ("ends_at" > "starts_at");

-- Nenhuma sala pode ter duas reservas CONFIRMADAS com intervalos sobrepostos.
-- '[)' = início incluso, fim excluso: uma reserva pode começar no minuto
-- exato em que a anterior termina.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" = 'CONFIRMED');