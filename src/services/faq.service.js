import { supabase } from '@/lib/supabase';
import { DEFAULT_FAQ_SECTIONS } from '@/data/faq-content';
import { normalizeFaqSections } from '@/lib/faq-utils';

const FAQ_ROW_ID = 'main';

const isMissingFaqTableError = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return raw.includes('faq_content') && (
    raw.includes('does not exist')
    || raw.includes('could not find')
    || raw.includes('schema cache')
  );
};

export const faqService = {
  async getContent() {
    const { data, error } = await supabase
      .from('faq_content')
      .select('sections, updated_at, updated_by')
      .eq('id', FAQ_ROW_ID)
      .maybeSingle();

    if (error) {
      if (isMissingFaqTableError(error)) {
        return {
          sections: DEFAULT_FAQ_SECTIONS,
          source: 'default',
          updated_at: null,
          updated_by: null,
        };
      }
      throw error;
    }

    if (!data || !Array.isArray(data.sections) || data.sections.length === 0) {
      return {
        sections: DEFAULT_FAQ_SECTIONS,
        source: 'default',
        updated_at: data?.updated_at || null,
        updated_by: data?.updated_by || null,
      };
    }

    return {
      sections: data.sections,
      source: 'database',
      updated_at: data.updated_at,
      updated_by: data.updated_by,
    };
  },

  async saveContent(sections, userId) {
    const normalized = normalizeFaqSections(sections);

    const { data, error } = await supabase
      .from('faq_content')
      .upsert({
        id: FAQ_ROW_ID,
        sections: normalized,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('sections, updated_at, updated_by')
      .single();

    if (error) {
      if (isMissingFaqTableError(error)) {
        throw new Error(
          'A tabela faq_content ainda não existe no Supabase. Execute a migration migrations/add_faq_content.sql no SQL Editor do projeto.',
        );
      }
      throw error;
    }

    return {
      sections: data.sections,
      source: 'database',
      updated_at: data.updated_at,
      updated_by: data.updated_by,
    };
  },
};
