"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateAnonymousDeviceId } from "@/lib/encryption"

const DEVICE_NAMES = [
  "John Wick",
  "James Bond",
  "Darth Vader",
  "The Joker",
  "Iron Man",
  "Luke Skywalker",
  "Harry Potter",
  "Mickey Mouse",
  "Donald Duck",
  "Peter Parker",
  "Fred Flintstone",
  "SpongeBob Squarepants",
  "Roger Rabbit",
  "Maximus Decimus",
  "Tony Montana",
  "Rick Blaine",
  "The Dude",
  "Gollum",
  "Mad Max",
  "Jack Sparrow",
  "Marty McFly",
  "Peter Venkman",
  "John McClane",
  "The Terminator",
  "Sarah Connor",
  "Han Solo",
  "Princess Leia",
  "Rocky Balboa",
  "Indiana Jones",
  "Michael Corleone",
  "Vito Corleone",
  "Jules Winnfield",
  "Tyler Durden",
  "Ellen Ripley",
  "Hannibal Lecter",
  "Gandalf",
  "The Bride",
  "Forrest Gump",
  "Mary Poppins",
  "Peter Pan",
  "King Kong",
  "Bruce Wayne",
  "Clark Kent",
  "Diana Prince",
  "Steve Rogers",
  "Tony Stark",
  "Walter White",
  "Jesse Pinkman",
  "Saul Goodman",
  "Tyrion Lannister",
  "Daenerys Targaryen",
  "Jon Snow",
  "Sherlock Holmes",
  "John Watson",
  "Homer Simpson",
  "Marge Simpson",
  "Bart Simpson",
  "Lisa Simpson",
  "Maggie Simpson",
  "Ned Flanders",
  "Eric Cartman",
  "Stan Marsh",
  "Kyle Broflovski",
  "Kenny McCormick",
  "Scooby Doo",
  "Shaggy Rogers",
  "Lois Griffin",
  "Rick Grimes",
  "Dexter Morgan",
  "Michael Scott",
  "Jim Halpert",
  "Pam Beesly",
  "Dwight Schrute",
  "Leslie Knope",
  "Ron Swanson",
  "Walter Mitty",
  "Ferris Bueller",
  "Norman Bates",
  "Travis Bickle",
  "Gordon Gekko",
  "Atticus Finch",
  "Alex DeLarge",
  "Holly Golightly",
  "Scarlett O'Hara",
  "Arthur Fleck",
  "Pennywise",
  "Jason Voorhees",
  "Freddy Krueger",
  "Michael Myers",
  "John Doe",
  "Dorian Gray",
  "Mr Bean",
  "Spock",
  "Captain Kirk",
  "Data",
  "Pikachu",
  "Jean-Luc Picard",
  "Buffy Summers",
  "Fox Mulder",
  "Dana Scully",
  "Agent Cooper",
  "Solid Snake",
  "Link",
  "Mario",
  "Lara Croft",
  "Geralt of Rivia",
  "Kratos",
  "Severus Snape",
  "Albus Dumbledore",
  "Sauron",
  "Aragorn",
  "Legolas",
  "Samwise Gamgee",
  "Bilbo Baggins",
  "Leia Organa",
  "Boba Fett",
  "Q",
  "Neo",
  "Morpheus",
  "Trinity",
  "Agent Smith",
  "Vito Corleone",
  "Tony Soprano",
  "Don Vito",
  "Keyser Soze",
  "Tyler Durden",
  "Madeline",
  "Seth Gecko",
  "Richard B. Riddick",
  "Beatrix Kiddo",
  "O-Ren Ishii",
  "Jules Winnfield",
  "Vincent Vega",
  "Mia Wallace",
  "Hans Landa",
  "Rick Deckard",
  "Deckard",
  "Rorschach",
  "Dr. Manhattan",
  "V",
  "John Constantine",
  "Beast",
  "Wolverine",
  "Professor X",
  "Magneto",
  "Storm",
  "Blade",
  "Alita",
  "K-2SO",
  "BB-8",
  "R2-D2",
  "C-3PO",
  "Mandalorian",
  "Grogu",
  "Eddie Brock",
  "Venom",
  "Shuri",
  "Okoye",
  "Mysterio",
  "Green Goblin",
  "Doctor Strange",
  "Wanda Maximoff",
  "Loki",
  "Hawkeye",
  "Nick Fury",
  "Phil Coulson",
  "Joker",
  "Two-Face",
  "Riddler",
  "Penguin",
  "Mad Hatter",
  "Edward Scissorhands",
  "Sweeney Todd",
  "Mr. Fox",
  "Fantastic Mr. Fox",
  "Coraline",
  "Jack Skellington",
  "Sally",
  "Hiccup",
  "Astrid",
  "Po",
  "Master Oogway",
  "Shrek",
  "Donkey",
  "Fiona",
  "Puss in Boots",
  "Mulan",
  "Simba",
  "Nala",
  "Scar",
  "Mufasa",
  "Elsa",
  "Anna",
  "Olaf",
  "Moana",
  "Maui",
  "Dory",
  "Marlin",
  "Nemo",
  "Marv",
  "Harry Callahan",
  "Dirty Harry",
  "Mater",
  "Lightning McQueen",
  "Sully",
  "Mike Wazowski",
  "Woody",
  "Buzz Lightyear",
  "Andy",
  "Zed",
  "Frodo Baggins",
  "Sam Gamgee",
  "Bilbo",
  "Artemis Fowl",
  "Professor Layton",
  "Nathan Drake",
  "Ellie",
  "Joel",
  "Tommy Vercetti",
  "CJ",
  "Claude",
  "Trevor Phillips",
  "Michael De Santa",
  "John Marston",
  "Arthur Morgan",
  "Dutch van der Linde",
  "Arthur Fleck",
  "Joker",
  "Vito Scaletta",
  "Corvo Attano",
  "Dishonored",
  "Aloy",
  "Kratos",
  "Nathan Drake",
  "Ellie Williams",
  "Cloud Strife",
  "Sephiroth",
  "Tifa Lockhart",
  "Aerith Gainsborough",
  "Solid Snake",
  "Sam Fisher",
  "John-117",
  "Master Chief",
  "Cortana",
  "Alan Wake",
  "Max Payne",
  "Gordon Freeman",
  "Alyx Vance",
  "Nathan Hale",
  "Spyro",
  "Crash Bandicoot",
  "Sonic"
];

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server-temp-id';
  
  const key = "pp-device-id"
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = generateAnonymousDeviceId()
  localStorage.setItem(key, id)
  return id
}

export function generateDeviceName(): string {
  const name = DEVICE_NAMES[Math.floor(Math.random() * DEVICE_NAMES.length)];
  return name;
}

export function getOrCreateDeviceName(): string {
  if (typeof window === 'undefined') return 'Server Device';
  
  const key = "pp-device-name"
  const existing = localStorage.getItem(key)
  if (existing) {
    // Conservative migration: detect legacy auto-generated adjective+noun names
    // (e.g. "Light Owl") and replace them with a name from the new pool.
    try {
      const parts = existing.trim().split(/\s+/);
      const looksLikeLegacyTwoWord = parts.length === 2 && /^[A-Z][a-z]+$/.test(parts[0]) && /^[A-Z][a-z]+$/.test(parts[1]);
      const isInNewPool = DEVICE_NAMES.includes(existing);
      if (looksLikeLegacyTwoWord && !isInNewPool) {
        const newName = generateDeviceName();
        localStorage.setItem(key, newName);
        try {
          // notify other parts of the app that the device name was migrated
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('pp-device-name-migrated', { detail: { name: newName } }));
          }
        } catch (e) {
          // ignore dispatch errors
        }
        return newName;
      }
    } catch (e) {
      // If any error occurs during detection, fall back to returning existing name
      console.warn('Device name migration check failed', e);
    }
    return existing
  }
  const name = generateDeviceName()
  localStorage.setItem(key, name)
  return name
}

export function getDeviceInfo() {
  return {
    id: getOrCreateDeviceId(),
    name: getOrCreateDeviceName(),
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'Unknown',
    isMobile: /Android|webOS|iPhone|iPad|BlackBerry|IE|Opera Mini/i.test(navigator.userAgent)
  }
}

export function heartbeat(supabase: SupabaseClient, code: string, deviceId: string) {
  let retryCount = 0;
  const maxRetries = 3;
  
  // update last_seen every 10s with retry logic
  const update = async () => {
    try {
      const { error } = await supabase
        .from("devices")
        .update({ last_seen: new Date().toISOString() })
        .eq("session_code", code)
        .eq("device_id", deviceId);
      
      if (error) {
        console.warn("Heartbeat error:", error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.error("Max heartbeat retries reached, device may be disconnected");
        }
      } else {
        retryCount = 0; // Reset on success
      }
    } catch (e) {
      console.warn("Heartbeat failed:", e);
      retryCount++;
    }
  }
  
  update(); // Initial heartbeat
  const iv = setInterval(update, 10_000); // Every 10 seconds

  const ch = supabase
    .channel(`kicked-${code}-${deviceId}`)
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "devices", filter: `session_code=eq.${code}` },
      (payload) => {
        if ((payload.old as any)?.device_id === deviceId) {
          alert("You have been removed from this session.")
          window.location.href = "/"
        }
      },
    )
    .subscribe()

  return () => {
    clearInterval(iv)
    supabase.removeChannel(ch)
  }
}
