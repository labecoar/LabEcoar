// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScore } from "@/hooks/useScores";
import { useFaqContent, useSaveFaqContent } from "@/hooks/useFaq";
import {
  cloneFaqSections,
  createEmptyFaqItem,
  faqItemToPlainAnswer,
  normalizeFaqSections,
  plainAnswerToFaqItem,
  validateFaqSections,
} from "@/lib/faq-utils";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";
import { HelpCircle, Search, Star, ChevronDown, Mail, Pencil, Save, X, Plus, Trash2 } from "lucide-react";
import { C, heading, body } from "@/lib/theme";
import { FAQ_SECTIONS } from "@/data/faq-content";

const SECTION_COLORS = {
  lime: { color: C.lime, bg: C.lime_back },
  blue: { color: C.blue, bg: C.blue_back },
  orange: { color: C.orange, bg: C.orange_back },
  purple: { color: C.purple, bg: "rgba(170, 102, 255, 0.12)" },
  cyan: { color: C.cyan, bg: "rgba(68, 204, 255, 0.12)" },
  pink: { color: C.pink, bg: "rgba(232, 51, 174, 0.12)" },
};

const inputStyle = {
  backgroundColor: "rgba(var(--ink),0.04)",
  border: "1px solid rgba(var(--ink),0.12)",
  color: C.cream,
  fontSize: 13,
  borderRadius: 12,
  padding: "10px 14px",
  outline: "none",
  width: "100%",
  ...body,
};

const normalize = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const itemMatchesQuery = (item, query) => {
  if (!query) return true;
  const haystack = [
    item.question,
    faqItemToPlainAnswer(item),
  ].join(" ");
  return normalize(haystack).includes(query);
};

function FaqAnswer({ item, accent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {(item.paragraphs || []).map((p, i) => (
        <p key={i} style={{ fontSize: 13, color: `${C.cream}75`, lineHeight: 1.65, margin: 0 }}>
          {p}
        </p>
      ))}

      {(item.subsections || []).map((sub, i) => (
        <div key={i}>
          <p style={{ ...heading, fontSize: 12, fontWeight: 700, color: accent, marginBottom: 6 }}>
            {sub.title}
          </p>
          {(sub.paragraphs || []).map((p, j) => (
            <p key={j} style={{ fontSize: 13, color: `${C.cream}75`, lineHeight: 1.65, margin: "0 0 8px" }}>
              {p}
            </p>
          ))}
          {sub.bullets?.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              {sub.bullets.map((b, j) => (
                <li key={j} style={{ fontSize: 13, color: `${C.cream}75`, lineHeight: 1.55 }}>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {item.paragraphsAfter?.map((p, i) => (
        <p key={`after-${i}`} style={{ fontSize: 13, color: `${C.cream}75`, lineHeight: 1.65, margin: 0 }}>
          {p}
        </p>
      ))}

      {item.alert && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            backgroundColor: `${C.orange}14`,
            border: `1px solid ${C.orange}30`,
            fontSize: 12,
            color: C.orange,
            lineHeight: 1.55,
            fontWeight: 600,
          }}
        >
          ATENÇÃO: {item.alert}
        </div>
      )}
    </div>
  );
}

function FaqAccordionItem({
  item,
  accent,
  isOpen,
  onToggle,
  editMode,
  draftAnswer,
  onQuestionChange,
  onAnswerChange,
  onDelete,
  anchorId,
}) {
  return (
    <div
      id={anchorId}
      style={{
        borderRadius: 14,
        backgroundColor: C.card,
        border: `1px solid ${isOpen || editMode ? `${accent}30` : "rgba(var(--ink),0.06)"}`,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
    >
      {editMode ? (
        <div className="px-4 py-4 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <input
              value={item.question || ""}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder="Pergunta"
              style={{ ...inputStyle, fontWeight: 700, ...heading }}
            />
            <button
              type="button"
              onClick={onDelete}
              className="shrink-0 p-2 rounded-xl transition-colors hover:brightness-110"
              style={{ color: C.orange, backgroundColor: `${C.orange}12`, border: `1px solid ${C.orange}25` }}
              title="Excluir pergunta"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            value={draftAnswer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Resposta (separe parágrafos com uma linha em branco)"
            rows={6}
            style={{ ...inputStyle, resize: "vertical", minHeight: 120, lineHeight: 1.6 }}
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-start justify-between gap-3 text-left px-4 py-4 transition-colors hover:brightness-110"
            style={{ background: "transparent" }}
          >
            <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: C.cream, lineHeight: 1.4 }}>
              {item.question}
            </span>
            <ChevronDown
              size={16}
              style={{
                color: accent,
                flexShrink: 0,
                marginTop: 2,
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </button>
          {isOpen && (
            <div
              style={{
                padding: "0 16px 16px",
                borderTop: `1px solid rgba(var(--ink),0.05)`,
                paddingTop: 14,
              }}
            >
              <FaqAnswer item={item} accent={accent} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function FAQ() {
  const { user, isAdmin } = useAuth();
  const { data: userScore } = useUserScore(user?.id);
  const { data: faqData, isLoading: faqLoading } = useFaqContent();
  const saveFaq = useSaveFaqContent();

  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("todas");
  const [openKey, setOpenKey] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftSections, setDraftSections] = useState([]);
  const [scrollToItemId, setScrollToItemId] = useState(null);

  const faqSections = useMemo(
    () => (faqData?.sections?.length ? faqData.sections : FAQ_SECTIONS),
    [faqData?.sections],
  );
  const displaySections = isEditing ? draftSections : faqSections;

  useEffect(() => {
    if (!scrollToItemId) return;

    const timer = window.setTimeout(() => {
      document.getElementById(scrollToItemId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setScrollToItemId(null);
    }, 50);

    return () => window.clearTimeout(timer);
  }, [scrollToItemId, draftSections]);

  const normalizedSearch = normalize(search.trim());

  const filteredSections = useMemo(() => {
    return displaySections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => itemMatchesQuery(item, normalizedSearch)),
      }))
      .filter((section) => {
        if (activeSection !== "todas" && section.id !== activeSection) return false;
        return section.items.length > 0 || isEditing;
      });
  }, [displaySections, normalizedSearch, activeSection, isEditing]);

  const visibleCount = filteredSections.reduce((sum, s) => sum + s.items.length, 0);

  const toggleItem = (key) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const startEditing = () => {
    setDraftSections(
      cloneFaqSections(faqSections).map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          _answerText: faqItemToPlainAnswer(item),
        })),
      })),
    );
    setIsEditing(true);
    setOpenKey(null);
  };

  const cancelEditing = () => {
    if (saveFaq.isPending) return;
    setIsEditing(false);
    setDraftSections([]);
  };

  const updateDraftItem = (sectionIndex, itemIndex, updates) => {
    setDraftSections((prev) => {
      const next = cloneFaqSections(prev);
      next[sectionIndex].items[itemIndex] = {
        ...next[sectionIndex].items[itemIndex],
        ...updates,
      };
      return next;
    });
  };

  const updateDraftAnswer = (sectionIndex, itemIndex, text) => {
    updateDraftItem(sectionIndex, itemIndex, { _answerText: text });
  };

  const deleteDraftItem = (sectionIndex, itemIndex) => {
    const confirmed = window.confirm("Excluir esta pergunta?");
    if (!confirmed) return;

    setDraftSections((prev) => {
      const next = cloneFaqSections(prev);
      next[sectionIndex].items.splice(itemIndex, 1);
      return next;
    });
  };

  const addDraftItem = (sectionIndex, sectionId) => {
    const newItemIndex = draftSections[sectionIndex]?.items?.length ?? 0;

    setDraftSections((prev) => {
      const next = cloneFaqSections(prev);
      next[sectionIndex].items.push({
        ...createEmptyFaqItem(),
        _answerText: "",
      });
      return next;
    });

    setScrollToItemId(`faq-edit-${sectionId}-${newItemIndex}`);
  };

  const handleSave = async () => {
    const merged = draftSections.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        plainAnswerToFaqItem(item.question, item._answerText ?? faqItemToPlainAnswer(item)),
      ),
    }));

    const errors = validateFaqSections(merged);
    if (errors.length) {
      notifyWarning(errors[0]);
      return;
    }

    try {
      await saveFaq.mutateAsync({
        sections: normalizeFaqSections(merged),
        userId: user?.id,
      });
      notifySuccess("FAQ atualizado com sucesso.");
      setIsEditing(false);
      setDraftSections([]);
    } catch (saveError) {
      console.error("Erro ao salvar FAQ:", saveError);
      notifyError(saveError?.message || "Não foi possível salvar o FAQ.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.black, ...body }}>
      <div
        className="hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10"
        style={{
          backgroundColor: `${C.black}F5`,
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(var(--ink),0.05)",
        }}
      >
        <div className="flex items-center gap-3">
          <HelpCircle size={16} style={{ color: C.lime }} />
          <span
            style={{
              ...heading,
              fontSize: 12,
              fontWeight: 700,
              color: `${C.cream}60`,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            FAQ
          </span>
          {isEditing && (
            <span
              className="px-2 py-0.5 rounded-full"
              style={{ fontSize: 11, fontWeight: 700, color: C.orange, backgroundColor: `${C.orange}18` }}
            >
              Editando
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && !isEditing && (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:brightness-110"
              style={{ backgroundColor: `${C.lime}18`, color: C.lime, ...heading, fontSize: 12, fontWeight: 700 }}
            >
              <Pencil size={13} />
              Editar FAQ
            </button>
          )}

          {isAdmin && isEditing && (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saveFaq.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: "rgba(var(--ink),0.08)", color: `${C.cream}80`, ...heading, fontSize: 12, fontWeight: 700 }}
              >
                <X size={13} />
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveFaq.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontSize: 12, fontWeight: 700 }}
              >
                <Save size={13} />
                {saveFaq.isPending ? "Salvando..." : "Salvar"}
              </button>
            </>
          )}

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: C.lime, color: C.onAccent }}
          >
            <Star size={11} fill={C.onAccent} />
            <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>
              {userScore?.total_points || 0} pts
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-4xl mx-auto w-full min-w-0">
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none"
              style={{ ...heading, color: C.cream }}
            >
              Perguntas Frequentes
            </h1>
            <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>
              {isEditing
                ? "Edite perguntas e respostas. Separe parágrafos com uma linha em branco."
                : "Tudo o que você precisa saber sobre o CuícaLab."}
            </p>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 md:hidden">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl"
                  style={{ backgroundColor: `${C.lime}18`, color: C.lime, ...heading, fontSize: 12, fontWeight: 700 }}
                >
                  <Pencil size={13} />
                  Editar FAQ
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saveFaq.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl disabled:opacity-50"
                    style={{ backgroundColor: "rgba(var(--ink),0.08)", color: `${C.cream}80`, ...heading, fontSize: 12, fontWeight: 700 }}
                  >
                    <X size={13} />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveFaq.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl disabled:opacity-50"
                    style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontSize: 12, fontWeight: 700 }}
                  >
                    <Save size={13} />
                    {saveFaq.isPending ? "Salvando..." : "Salvar"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {!isEditing && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-6"
            style={{ backgroundColor: C.card, border: "1px solid rgba(var(--ink),0.06)" }}
          >
            <Search size={16} style={{ color: `${C.cream}40`, flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pergunta ou assunto..."
              className="flex-1 bg-transparent outline-none placeholder:text-white/30"
              style={{ fontSize: 14, color: C.cream }}
            />
          </div>
        )}

        <div
          className="flex items-center gap-2 mb-8 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          <button
            onClick={() => setActiveSection("todas")}
            className="shrink-0 px-4 py-2 rounded-xl transition-all duration-150"
            style={{
              backgroundColor: activeSection === "todas" ? C.lime : "rgba(var(--ink),0.06)",
              color: activeSection === "todas" ? C.black : `${C.cream}70`,
              fontWeight: activeSection === "todas" ? 700 : 400,
              ...heading,
              fontSize: 13,
            }}
          >
            Todas
          </button>
          {displaySections.map((section) => {
            const palette = SECTION_COLORS[section.colorKey] || SECTION_COLORS.lime;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="shrink-0 px-4 py-2 rounded-xl transition-all duration-150"
                style={{
                  backgroundColor: active ? palette.color : "rgba(var(--ink),0.06)",
                  color: active ? (palette.color === C.lime ? C.black : C.cream) : `${C.cream}70`,
                  fontWeight: active ? 700 : 400,
                  ...heading,
                  fontSize: 13,
                }}
              >
                {section.title}
              </button>
            );
          })}
        </div>

        {faqLoading ? (
          <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: C.card, border: "1px solid rgba(var(--ink),0.06)" }}>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-4" style={{ borderColor: C.lime }} />
            <p style={{ color: `${C.cream}50`, fontSize: 14 }}>Carregando perguntas...</p>
          </div>
        ) : visibleCount === 0 && !isEditing ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{ backgroundColor: C.card, border: "1px solid rgba(var(--ink),0.06)" }}
          >
            <HelpCircle size={36} style={{ color: `${C.cream}20`, margin: "0 auto 12px" }} />
            <p style={{ ...heading, fontSize: 16, fontWeight: 700, color: `${C.cream}40` }}>
              Nenhuma pergunta encontrada.
            </p>
            <p style={{ fontSize: 13, color: `${C.cream}30`, marginTop: 6 }}>
              Tente buscar com outras palavras ou limpe o filtro.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {filteredSections.map((section) => {
              const sectionIndex = draftSections.findIndex((s) => s.id === section.id);
              const palette = SECTION_COLORS[section.colorKey] || SECTION_COLORS.lime;
              return (
                <section key={section.id}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: palette.color,
                          flexShrink: 0,
                        }}
                      />
                      <h2
                        style={{
                          ...heading,
                          fontSize: 16,
                          fontWeight: 800,
                          color: palette.color,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {section.title}
                      </h2>
                      <span style={{ fontSize: 11, color: `${C.cream}35` }}>
                        {section.items.length}
                      </span>
                    </div>

                    {isEditing && sectionIndex >= 0 && (
                      <button
                        type="button"
                        onClick={() => addDraftItem(sectionIndex, section.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all hover:brightness-110"
                        style={{
                          color: palette.color,
                          backgroundColor: `${palette.color}12`,
                          border: `1px solid ${palette.color}25`,
                          ...heading,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <Plus size={13} />
                        Nova pergunta
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {section.items.map((item, itemIndex) => {
                      const itemKey = `${section.id}-${itemIndex}`;
                      return (
                        <FaqAccordionItem
                          key={itemKey}
                          item={item}
                          accent={palette.color}
                          isOpen={openKey === itemKey}
                          onToggle={() => toggleItem(itemKey)}
                          editMode={isEditing}
                          draftAnswer={item._answerText ?? ""}
                          anchorId={isEditing ? `faq-edit-${section.id}-${itemIndex}` : undefined}
                          onQuestionChange={(value) => updateDraftItem(sectionIndex, itemIndex, { question: value })}
                          onAnswerChange={(value) => updateDraftAnswer(sectionIndex, itemIndex, value)}
                          onDelete={() => deleteDraftItem(sectionIndex, itemIndex)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {!isEditing && (
          <div
            className="mt-10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            style={{ backgroundColor: C.darkGreen, border: `1px solid ${C.lime}20` }}
          >
            <div>
              <p style={{ ...heading, fontSize: 15, fontWeight: 800, color: C.cream, marginBottom: 4 }}>
                Ainda com dúvidas?
              </p>
              <p style={{ fontSize: 13, color: `${C.cream}60`, lineHeight: 1.5 }}>
                Fale com a equipe da Cuíca pelos canais oficiais de suporte.
              </p>
            </div>
            <a
              href="mailto:comunidade@agenciacuica.com"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all hover:brightness-110 shrink-0"
              style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 13 }}
            >
              <Mail size={14} />
              comunidade@agenciacuica.com
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
