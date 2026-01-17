-- Update special_cards table to allow all card types including category-specific exchange cards
-- This adds missing card types to the CHECK constraint

-- First, drop the existing CHECK constraint
ALTER TABLE special_cards 
DROP CONSTRAINT IF EXISTS special_cards_card_type_check;

-- Recreate the constraint with all card types
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
  'exchange-additional'
));

COMMENT ON CONSTRAINT special_cards_card_type_check ON special_cards IS 
'Validates that card_type is one of the allowed special card types, including category-specific exchange cards';
