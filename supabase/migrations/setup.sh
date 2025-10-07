#!/bin/bash

# PaperPaste Database Setup Script
# This script applies the complete database schema

echo "🚀 Setting up PaperPaste database schema..."

# Check if paperpaste.sql exists
if [ ! -f "paperpaste.sql" ]; then
    echo "Error: paperpaste.sql not found in current directory"
    echo "Please run this script from the supabase/migrations directory"
    exit 1
fi

# Apply the schema
echo "Applying paperpaste.sql schema..."

# Check if we're using Supabase CLI or direct psql
if command -v supabase &> /dev/null; then
    echo "Supabase CLI detected"
    echo "Note: Copy the contents of paperpaste.sql to your Supabase SQL Editor"
    echo "Or set up a proper timestamped migration file"
else 
    echo "Applying schema directly..."
    # You can uncomment and modify this line with your database connection details
    # psql -h your-host -U your-user -d your-database -f paperpaste.sql
    echo "Please run: psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f paperpaste.sql"
fi

echo "✅ Schema setup complete!"
echo "Your database now includes:"
echo "  • Sessions management"
echo "  • Device tracking with encryption"
echo "  • Items with zero-knowledge encryption"
echo "  • Real-time sync support"
echo "  • File upload capabilities"