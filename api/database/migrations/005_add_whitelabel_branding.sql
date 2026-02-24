-- Migration: Add whitelabel branding data storage
-- This allows each whitelabel to store branding configuration (colors, logos)
-- in a JSON field that can be fetched by the frontend for dynamic theming

-- Add data JSON field to Whitelabels table
ALTER TABLE Whitelabels
ADD COLUMN data JSON NULL AFTER suspension_behavior;

-- Seed branding data for existing whitelabels
UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#D4002A',
  'secondary_color', '#000000',
  'logo_url', '/assets/logos/kw-logo.png'
) WHERE code = 'kw';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#164d86',
  'secondary_color', '#b12029',
  'logo_url', '/assets/logos/yhs-logo.png'
) WHERE code = 'yhs';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#164d86',
  'secondary_color', '#c20f19',
  'logo_url', '/assets/logos/uco-logo.png'
) WHERE code = 'uco';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#4d9cb9',
  'secondary_color', '#ec8b33',
  'logo_url', '/assets/logos/mop-logo.png'
) WHERE code = 'mop';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#4d9cb9',
  'secondary_color', '#ec8b33',
  'logo_url', '/assets/logos/eco-logo.png'
) WHERE code = 'eco';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#4d9cb9',
  'secondary_color', '#ec8b33',
  'logo_url', '/assets/logos/platinum-logo.png'
) WHERE code = 'platinum';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#4d9cb9',
  'secondary_color', '#ec8b33',
  'logo_url', '/assets/logos/default-logo.png'
) WHERE code = 'default';
