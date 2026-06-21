// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScore } from "@/hooks/useScores";
import { HelpCircle, Search, Star, ChevronDown, Mail } from "lucide-react";
import { C, heading, body } from "@/lib/theme";
import { FAQ_SECTIONS, FAQ_TOTAL_COUNT } from "@/data/faq-content";

const SECTION_COLORS = {
  lime: { color: C.lime, bg: C.lime_back },
  blue: { color: C.blue, bg: C.blue_back },
  orange: { color: C.orange, bg: C.orange_back },
  purple: { color: C.purple, bg: "rgba(170, 102, 255, 0.12)" },
  cyan: { color: C.cyan, bg: "rgba(68, 204, 255, 0.12)" },
  pink: { color: C.pink, bg: "rgba(232, 51, 174, 0.12)" },
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
    ...(item.paragraphs || []),
    ...(item.paragraphsAfter || []),
    item.alert,
    ...(item.subsections || []).flatMap((s) => [
      s.title,
      ...(s.paragraphs || []),
      ...(s.bullets || []),
    ]),
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

function FaqAccordionItem({ item, accent, accentBg, isOpen, onToggle }) {
  return (
    <div
      style={{
        borderRadius: 14,
        backgroundColor: C.card,
        border: `1px solid ${isOpen ? `${accent}30` : "rgba(255,255,222,0.06)"}`,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
    >
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
            borderTop: `1px solid rgba(255,255,222,0.05)`,
            paddingTop: 14,
          }}
        >
          <FaqAnswer item={item} accent={accent} />
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const { user } = useAuth();
  const { data: userScore } = useUserScore(user?.id);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("todas");
  const [openKey, setOpenKey] = useState(null);

  const normalizedSearch = normalize(search.trim());

  const filteredSections = useMemo(() => {
    return FAQ_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => itemMatchesQuery(item, normalizedSearch)),
    })).filter((section) => {
      if (activeSection !== "todas" && section.id !== activeSection) return false;
      return section.items.length > 0;
    });
  }, [normalizedSearch, activeSection]);

  const visibleCount = filteredSections.reduce((sum, s) => sum + s.items.length, 0);

  const toggleItem = (key) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  return (
    <div style={{ minHeight: "100vh", background: C.black, ...body }}>
      <div
        className="flex items-center justify-between px-8 py-4 sticky top-0 z-10"
        style={{
          backgroundColor: `${C.black}F5`,
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,222,0.05)",
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
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: C.lime, color: C.black }}
        >
          <Star size={11} fill={C.black} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>
            {userScore?.total_points || 0} pts
          </span>
        </div>
      </div>

      <div className="px-8 pt-7 pb-10 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1
            style={{
              ...heading,
              fontSize: 40,
              fontWeight: 900,
              color: C.cream,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            Perguntas Frequentes
          </h1>
          <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>
            Tudo o que você precisa saber sobre o CuícaLab.
          </p>
        </div>

        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-6"
          style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,222,0.06)" }}
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

        <div
          className="flex items-center gap-2 mb-8 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          <button
            onClick={() => setActiveSection("todas")}
            className="shrink-0 px-4 py-2 rounded-xl transition-all duration-150"
            style={{
              backgroundColor: activeSection === "todas" ? C.lime : "rgba(255,255,222,0.06)",
              color: activeSection === "todas" ? C.black : `${C.cream}70`,
              fontWeight: activeSection === "todas" ? 700 : 400,
              ...heading,
              fontSize: 13,
            }}
          >
            Todas
          </button>
          {FAQ_SECTIONS.map((section) => {
            const palette = SECTION_COLORS[section.colorKey] || SECTION_COLORS.lime;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="shrink-0 px-4 py-2 rounded-xl transition-all duration-150"
                style={{
                  backgroundColor: active ? palette.color : "rgba(255,255,222,0.06)",
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

        {visibleCount === 0 ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,222,0.06)" }}
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
              const palette = SECTION_COLORS[section.colorKey] || SECTION_COLORS.lime;
              return (
                <section key={section.id}>
                  <div className="flex items-center gap-2 mb-4">
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
                  <div className="flex flex-col gap-2">
                    {section.items.map((item) => {
                      const key = `${section.id}-${item.question}`;
                      return (
                        <FaqAccordionItem
                          key={key}
                          item={item}
                          accent={palette.color}
                          accentBg={palette.bg}
                          isOpen={openKey === key}
                          onToggle={() => toggleItem(key)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

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
            style={{ backgroundColor: C.lime, color: C.black, ...heading, fontWeight: 700, fontSize: 13 }}
          >
            <Mail size={14} />
            comunidade@agenciacuica.com
          </a>
        </div>
      </div>
    </div>
  );
}
