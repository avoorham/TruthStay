-- Migration 038: replace budget text field with budget_min / budget_max (EUR integers)

ALTER TABLE public.adventures
  ADD COLUMN budget_min integer,
  ADD COLUMN budget_max integer;

UPDATE public.adventures
  SET
    budget_min = CASE budget
      WHEN 'low'    THEN 500
      WHEN 'budget' THEN 500
      WHEN 'mid'    THEN 1500
      WHEN 'high'   THEN 3500
      WHEN 'luxury' THEN 3500
      ELSE 1500
    END,
    budget_max = CASE budget
      WHEN 'low'    THEN 1500
      WHEN 'budget' THEN 1500
      WHEN 'mid'    THEN 3500
      WHEN 'high'   THEN 8000
      WHEN 'luxury' THEN 8000
      ELSE 3500
    END;

ALTER TABLE public.adventures DROP COLUMN budget;
