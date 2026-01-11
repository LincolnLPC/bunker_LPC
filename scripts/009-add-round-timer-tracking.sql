-- Add round timer tracking to game_rooms
-- This allows automatic timer management on the server

ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS round_started_at TIMESTAMPTZ;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_game_rooms_phase_round_started 
ON game_rooms(phase, round_started_at) 
WHERE phase IN ('playing', 'voting');

-- Function to check and auto-advance rounds based on timer
CREATE OR REPLACE FUNCTION check_round_timer()
RETURNS void AS $$
DECLARE
  room_record RECORD;
  elapsed_seconds INTEGER;
BEGIN
  -- Find all active playing or voting rooms with started timers
  FOR room_record IN
    SELECT id, phase, current_round, round_timer_seconds, round_started_at, settings
    FROM game_rooms
    WHERE phase IN ('playing', 'voting')
      AND round_started_at IS NOT NULL
      AND round_started_at + (round_timer_seconds || ' seconds')::INTERVAL <= NOW()
  LOOP
    elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - room_record.round_started_at))::INTEGER;
    
    -- If in playing phase, transition to voting
    IF room_record.phase = 'playing' THEN
      UPDATE game_rooms
      SET phase = 'voting',
          round_started_at = NOW()
      WHERE id = room_record.id;
      
      -- Add system message about auto-transition
      INSERT INTO chat_messages (room_id, player_id, message, message_type)
      VALUES (
        room_record.id,
        NULL,
        format('Раунд %s завершен. Началось голосование.', room_record.current_round),
        'system'
      );
      
    -- If in voting phase and timer expired, this should be handled by host manually
    -- But we can add a notification
    ELSIF room_record.phase = 'voting' THEN
      -- Voting phase expiration is typically handled manually by host
      -- But we can extend the timer or notify
      UPDATE game_rooms
      SET round_started_at = round_started_at + INTERVAL '30 seconds' -- Extend by 30 seconds
      WHERE id = room_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Note: This function should be called periodically via a cron job or Edge Function
-- For Supabase, you can use pg_cron extension or Edge Functions with scheduled triggers
