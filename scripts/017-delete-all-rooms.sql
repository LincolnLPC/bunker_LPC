-- Delete all game rooms and related data
-- WARNING: This will delete ALL rooms, players, votes, chat messages, and characteristics
-- Use with caution!

-- Delete all votes
DELETE FROM votes;

-- Delete all chat messages
DELETE FROM chat_messages;

-- Delete all player characteristics
DELETE FROM player_characteristics;

-- Delete all players
DELETE FROM game_players;

-- Delete all rooms
DELETE FROM game_rooms;

-- Verify deletion
SELECT COUNT(*) as remaining_rooms FROM game_rooms;
SELECT COUNT(*) as remaining_players FROM game_players;
SELECT COUNT(*) as remaining_votes FROM votes;
SELECT COUNT(*) as remaining_chat_messages FROM chat_messages;
SELECT COUNT(*) as remaining_characteristics FROM player_characteristics;
