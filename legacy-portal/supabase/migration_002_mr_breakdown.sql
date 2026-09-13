-- Run this in Supabase SQL Editor. Safe to run even with existing data —
-- it only adds new columns, nothing is removed or overwritten.

alter table snapshots
  add column if not exists cur_2mr_acts numeric,
  add column if not exists cur_2mr_pay numeric,
  add column if not exists cur_2mr_pct numeric,
  add column if not exists prev_2mr_acts numeric,
  add column if not exists prev_2mr_pay numeric,
  add column if not exists prev_2mr_pct numeric,

  add column if not exists cur_3mr_acts numeric,
  add column if not exists cur_3mr_pay numeric,
  add column if not exists cur_3mr_pct numeric,
  add column if not exists prev_3mr_acts numeric,
  add column if not exists prev_3mr_pay numeric,
  add column if not exists prev_3mr_pct numeric,

  add column if not exists cur_4mr_acts numeric,
  add column if not exists cur_4mr_pay numeric,
  add column if not exists cur_4mr_pct numeric,
  add column if not exists prev_4mr_acts numeric,
  add column if not exists prev_4mr_pay numeric,
  add column if not exists prev_4mr_pct numeric,

  add column if not exists cur_5mr_acts numeric,
  add column if not exists cur_5mr_pay numeric,
  add column if not exists cur_5mr_pct numeric,
  add column if not exists prev_5mr_acts numeric,
  add column if not exists prev_5mr_pay numeric,
  add column if not exists prev_5mr_pct numeric,

  add column if not exists cur_6mr_acts numeric,
  add column if not exists cur_6mr_pay numeric,
  add column if not exists cur_6mr_pct numeric,
  add column if not exists prev_6mr_acts numeric,
  add column if not exists prev_6mr_pay numeric,
  add column if not exists prev_6mr_pct numeric,

  add column if not exists cur_7mr_acts numeric,
  add column if not exists cur_7mr_pay numeric,
  add column if not exists cur_7mr_pct numeric,
  add column if not exists prev_7mr_acts numeric,
  add column if not exists prev_7mr_pay numeric,
  add column if not exists prev_7mr_pct numeric,

  -- Direct percentages straight from the sheet (more accurate than us
  -- computing them client-side from raw counts)
  add column if not exists cur_family_pct numeric,
  add column if not exists prev_family_pct numeric,
  add column if not exists cur_port_pct numeric,
  add column if not exists prev_port_pct numeric,
  add column if not exists cur_50_pct numeric,
  add column if not exists prev_50_pct numeric,
  add column if not exists cur_65_pct numeric,
  add column if not exists prev_65_pct numeric,
  add column if not exists cur_fwa_close_pct numeric,
  add column if not exists prev_fwa_close_pct numeric,
  add column if not exists cur_pacing_pct numeric,
  add column if not exists cur_zulu_pct numeric,
  add column if not exists prev_zulu_pct numeric;
