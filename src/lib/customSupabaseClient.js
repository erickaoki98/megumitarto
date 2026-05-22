import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hudxninxnaigenbrigzk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1ZHhuaW54bmFpZ2VuYnJpZ3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDM2MTIsImV4cCI6MjA4MDkxOTYxMn0.zpf9vnZGmP2Cpou43YtHqGtuCEtVkIRFxAUdrUvioBY';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
