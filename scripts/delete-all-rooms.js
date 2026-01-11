// Script to delete all game rooms and related data
// Run with: node scripts/delete-all-rooms.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function deleteAllRooms() {
  try {
    console.log('Starting deletion of all rooms and related data...')

    // Get counts before deletion
    const [roomsResult, playersResult, votesResult, chatResult, characteristicsResult] = await Promise.all([
      supabase.from('game_rooms').select('*', { count: 'exact', head: true }),
      supabase.from('game_players').select('*', { count: 'exact', head: true }),
      supabase.from('votes').select('*', { count: 'exact', head: true }),
      supabase.from('chat_messages').select('*', { count: 'exact', head: true }),
      supabase.from('player_characteristics').select('*', { count: 'exact', head: true }),
    ])

    const counts = {
      rooms: roomsResult.count || 0,
      players: playersResult.count || 0,
      votes: votesResult.count || 0,
      chat: chatResult.count || 0,
      characteristics: characteristicsResult.count || 0,
    }

    console.log('Counts before deletion:', counts)

    if (counts.rooms === 0) {
      console.log('No rooms to delete.')
      return
    }

    // Get all room IDs
    const { data: allRooms } = await supabase.from('game_rooms').select('id')
    const roomIds = allRooms?.map((r) => r.id) || []

    console.log(`Found ${roomIds.length} rooms to delete`)

    // Delete all related data
    console.log('Deleting votes...')
    if (roomIds.length > 0) {
      await supabase.from('votes').delete().in('room_id', roomIds)
    } else {
      await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }

    console.log('Deleting chat messages...')
    if (roomIds.length > 0) {
      await supabase.from('chat_messages').delete().in('room_id', roomIds)
    } else {
      await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }

    console.log('Deleting player characteristics...')
    await supabase.from('player_characteristics').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    console.log('Deleting players...')
    if (roomIds.length > 0) {
      await supabase.from('game_players').delete().in('room_id', roomIds)
    } else {
      await supabase.from('game_players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }

    console.log('Deleting rooms...')
    if (roomIds.length > 0) {
      await supabase.from('game_rooms').delete().in('id', roomIds)
    } else {
      await supabase.from('game_rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }

    console.log('Successfully deleted all rooms and related data!')
    console.log('Deleted:', counts)
  } catch (error) {
    console.error('Error deleting rooms:', error)
    process.exit(1)
  }
}

deleteAllRooms()
