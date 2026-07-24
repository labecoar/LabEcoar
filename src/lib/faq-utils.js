export const FAQ_COLOR_OPTIONS = [
  { value: 'lime', label: 'Verde' },
  { value: 'blue', label: 'Azul' },
  { value: 'orange', label: 'Laranja' },
  { value: 'purple', label: 'Roxo' },
  { value: 'cyan', label: 'Ciano' },
  { value: 'pink', label: 'Rosa' },
];

export const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'secao';

export const cloneFaqSections = (sections) => JSON.parse(JSON.stringify(sections || []));

export const createEmptyFaqItem = () => ({
  question: '',
  paragraphs: [''],
  paragraphsAfter: [],
  alert: '',
  subsections: [],
});

export const createEmptyFaqSection = () => ({
  id: `secao-${Date.now()}`,
  title: 'Nova seção',
  colorKey: 'lime',
  items: [createEmptyFaqItem()],
});

export const createEmptySubsection = () => ({
  title: '',
  paragraphs: [''],
  bullets: [],
});

export const countFaqItems = (sections) =>
  (sections || []).reduce((sum, section) => sum + (section.items?.length || 0), 0);

export const normalizeFaqSections = (sections) =>
  cloneFaqSections(sections).map((section, sectionIndex) => {
    const id = slugify(section.id || section.title || `secao-${sectionIndex + 1}`);
    return {
      id,
      title: String(section.title || '').trim() || `Seção ${sectionIndex + 1}`,
      colorKey: section.colorKey || 'lime',
      items: (section.items || []).map((item) => ({
        question: String(item.question || '').trim(),
        paragraphs: (item.paragraphs || []).map((p) => String(p || '').trim()).filter(Boolean),
        paragraphsAfter: (item.paragraphsAfter || []).map((p) => String(p || '').trim()).filter(Boolean),
        alert: String(item.alert || '').trim(),
        subsections: (item.subsections || []).map((sub) => ({
          title: String(sub.title || '').trim(),
          paragraphs: (sub.paragraphs || []).map((p) => String(p || '').trim()).filter(Boolean),
          bullets: (sub.bullets || []).map((b) => String(b || '').trim()).filter(Boolean),
        })).filter((sub) => sub.title || sub.paragraphs.length || sub.bullets.length),
      })).filter((item) => item.question),
    };
  }).filter((section) => section.items.length > 0);

export const faqItemToPlainAnswer = (item) => {
  const parts = [];

  (item?.paragraphs || []).forEach((p) => {
    if (p?.trim()) parts.push(p.trim());
  });

  (item?.subsections || []).forEach((sub) => {
    if (sub.title?.trim()) parts.push(sub.title.trim());
    (sub.paragraphs || []).forEach((p) => {
      if (p?.trim()) parts.push(p.trim());
    });
    (sub.bullets || []).forEach((b) => {
      if (b?.trim()) parts.push(`• ${b.trim()}`);
    });
  });

  (item?.paragraphsAfter || []).forEach((p) => {
    if (p?.trim()) parts.push(p.trim());
  });

  if (item?.alert?.trim()) {
    parts.push(`ATENÇÃO: ${item.alert.trim()}`);
  }

  return parts.join('\n\n');
};

export const plainAnswerToFaqItem = (question, text) => {
  const paragraphs = String(text || '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    question: String(question || '').trim(),
    paragraphs,
    paragraphsAfter: [],
    alert: '',
    subsections: [],
  };
};

export const validateFaqSections = (sections) => {
  const errors = [];
  const ids = new Set();

  (sections || []).forEach((section, sectionIndex) => {
    const sectionLabel = section.title || `Seção ${sectionIndex + 1}`;
    const sectionId = slugify(section.id);

    if (!sectionId) errors.push(`${sectionLabel}: identificador inválido.`);
    if (ids.has(sectionId)) errors.push(`${sectionLabel}: identificador duplicado (${sectionId}).`);
    ids.add(sectionId);

    if (!String(section.title || '').trim()) {
      errors.push(`Seção ${sectionIndex + 1}: título obrigatório.`);
    }

    (section.items || []).forEach((item, itemIndex) => {
      if (!String(item.question || '').trim()) {
        errors.push(`${sectionLabel}, pergunta ${itemIndex + 1}: texto obrigatório.`);
      }

      const hasContent =
        (item.paragraphs || []).some(Boolean)
        || (item.paragraphsAfter || []).some(Boolean)
        || (item.subsections || []).length > 0
        || String(item.alert || '').trim();

      if (!hasContent) {
        errors.push(`${sectionLabel} · "${item.question || `Pergunta ${itemIndex + 1}`}": adicione ao menos um parágrafo, alerta ou subtópico.`);
      }
    });

    if (!(section.items || []).length) {
      errors.push(`${sectionLabel}: inclua ao menos uma pergunta.`);
    }
  });

  if (!(sections || []).length) {
    errors.push('O FAQ precisa ter ao menos uma seção.');
  }

  return errors;
};
