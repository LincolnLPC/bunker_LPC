// Script to delete all game rooms and related data
// Run with: node scripts/delete-all-rooms-simple.js

const { createClient } = require('@supabase/supabase-js')

// Try to load from .env.local or use environment variables
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// If not in env, try reading from .env.local file
if (!supabaseUrl || !supabaseServiceKey) {
  try {
    const fs = require('fs')
    const path = require('path')
    const envPath = path.join(__dirname, '..', '.env.local')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      const envLines = envContent.split('\n')
      for (const line of envLines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=')
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
          if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
            supabaseUrl = value
          } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
            supabaseServiceKey = value
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not read .env.local:', e.message)
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  console.error('Please set them in .env.local or as environment variables')
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
      const { error } = await supabase.from('votes').delete().in('room_id', roomIds)
      if (error) console.error('Error deleting votes:', error)
    } else {
      const { error } = await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) console.error('Error deleting votes:', error)
    }

    console.log('Deleting chat messages...')
    if (roomIds.length > 0) {
      const { error } = await supabase.from('chat_messages').delete().in('room_id', roomIds)
      if (error) console.error('Error deleting chat messages:', error)
    } else {
      const { error } = await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) console.error('Error deleting chat messages:', error)
    }

    console.log('Deleting player characteristics...')
    const { error: charError } = await supabase.from('player_characteristics').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (charError) console.error('Error deleting characteristics:', charError)

    console.log('Deleting special cards...')
    if (roomIds.length > 0) {
      const { error } = await supabase.from('special_cards').delete().in('room_id', roomIds)
      if (error) console.error('Error deleting special cards:', error)
    } else {
      const { error } = await supabase.from('special_cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) console.error('Error deleting special cards:', error)
    }

    console.log('Deleting players...')
    if (roomIds.length > 0) {
      const { error } = await supabase.from('game_players').delete().in('room_id', roomIds)
      if (error) console.error('Error deleting players:', error)
    } else {
      const { error } = await supabase.from('game_players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) console.error('Error deleting players:', error)
    }

    console.log('Deleting rooms...')
    if (roomIds.length > 0) {
      const { error } = await supabase.from('game_rooms').delete().in('id', roomIds)
      if (error) console.error('Error deleting rooms:', error)
    } else {
      const { error } = await supabase.from('game_rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) console.error('Error deleting rooms:', error)
    }

    console.log('Successfully deleted all rooms and related data!')
    console.log('Deleted:', counts)
  } catch (error) {
    console.error('Error deleting rooms:', error)
    process.exit(1)
  }
}

deleteAllRooms()
