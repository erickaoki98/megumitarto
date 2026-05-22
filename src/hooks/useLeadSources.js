import { supabase } from '@/lib/customSupabaseClient';

export function useLeadSources() {
  const fetchAllLeadSources = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_source_options')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching all lead sources:', error);
      return { success: false, error: error.message };
    }
  };

  const fetchActiveLeadSources = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_source_options')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching active lead sources:', error);
      return { success: false, error: error.message };
    }
  };

  const addLeadSource = async (name) => {
    try {
      const { data, error } = await supabase
        .from('lead_source_options')
        .insert([{ name, is_active: true }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error adding lead source:', error);
      return { success: false, error: error.message };
    }
  };

  const toggleLeadSourceStatus = async (id, currentStatus) => {
    try {
      const { data, error } = await supabase
        .from('lead_source_options')
        .update({ is_active: !currentStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error toggling lead source status:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteLeadSource = async (id) => {
    try {
      const { error } = await supabase
        .from('lead_source_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting lead source:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    fetchAllLeadSources,
    fetchActiveLeadSources,
    addLeadSource,
    toggleLeadSourceStatus,
    deleteLeadSource,
  };
}