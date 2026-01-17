-- Add category-specific reshuffle cards
-- These cards allow reshuffling specific categories without requiring category selection

-- Drop the existing CHECK constraint
ALTER TABLE special_cards 
DROP CONSTRAINT IF EXISTS special_cards_card_type_check;

-- Recreate the constraint with category-specific reshuffle cards
ALTER TABLE special_cards 
ADD CONSTRAINT special_cards_card_type_check 
CHECK (card_type IN (
  -- Basic cards
  'exchange',
  'peek',
  'immunity',
  'reroll',
  'reveal',
  'steal',
  'double-vote',
  'no-vote-against',
  'reshuffle',
  'revote',
  'replace-profession',
  'replace-health',
  -- Category-specific exchange cards
  'exchange-gender',
  'exchange-age',
  'exchange-profession',
  'exchange-bio',
  'exchange-health',
  'exchange-hobby',
  'exchange-phobia',
  'exchange-baggage',
  'exchange-fact',
  'exchange-special',
  'exchange-skill',
  'exchange-trait',
  'exchange-additional',
  -- Category-specific reshuffle cards
  'reshuffle-health',
  'reshuffle-bio',
  'reshuffle-fact',
  'reshuffle-baggage',
  'reshuffle-hobby'
));

COMMENT ON CONSTRAINT special_cards_card_type_check ON special_cards IS 
'Validates that card_type is one of the allowed special card types, including category-specific exchange and reshuffle cards';
