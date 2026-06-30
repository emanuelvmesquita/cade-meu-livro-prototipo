import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Home, BookOpen, RefreshCw, AlertTriangle, CheckSquare, Search, Plus, Download,
  Upload, Edit2, Copy, Trash2, X, Camera, Star, ArrowLeft,
  Heart, Settings, Bell, LogOut, Shield, User,
  Send, Clock, CheckCircle2, XCircle, BookMarked,
  StickyNote, MessageCircle, UsersRound, ShieldCheck, History, Image as ImageIcon,
  LayoutGrid, List, BookX,
  UserMinus, UserCheck, Key, Bookmark, ThumbsUp, UserPlus, Layers
} from "lucide-react";

/* =========================================================================
   DESIGN TOKENS
   BG #FAFAF7 · texto #1C1917 · primária #2B4C3F · accent #C0532B
   neutros #8A8478 / #E8E4DC / #F1EEE6
   Display: "Source Serif 4" · UI: "Inter"
   ========================================================================= */
const FONT_LINK_ID = "cml-fonts";
function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

const COLORS = {
  bg: "#FAFAF7",
  bgAlt: "#F1EEE6",
  card: "#FFFFFF",
  ink: "#1C1917",
  primary: "#2B4C3F",
  primaryDark: "#1E372D",
  accent: "#C0532B",
  accentLight: "#F3DFD3",
  neutral: "#8A8478",
  border: "#E3DDD0",
  success: "#2B6E4F",
  successBg: "#E4F0E8",
  warn: "#B8841E",
  warnBg: "#FAF0DC",
  danger: "#B23A2E",
  dangerBg: "#F8E4E0",
  neutralLight: "#C4BFB6",
};

/* =========================================================================
   PERSISTENCE HELPERS (localStorage)
   Adaptado do window.storage do ambiente Claude para localStorage do navegador.
   Mesma assinatura (loadKey/saveKey), para não precisar alterar o resto do app.
   ========================================================================= */
const STORAGE_PREFIX = "acervovivo:";

async function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error("storage save failed", key, e);
  }
}
async function deleteKey(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (e) {
    console.error("storage delete failed", key, e);
  }
}
async function listKeys(prefix = "") {
  try {
    const keys = [];
    const fullPrefix = STORAGE_PREFIX + prefix;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(fullPrefix)) keys.push(key.slice(STORAGE_PREFIX.length));
    }
    return keys;
  } catch {
    return [];
  }
}
async function deleteKeysByPrefix(prefix) {
  const keys = await listKeys(prefix);
  await Promise.all(keys.map((key) => deleteKey(key)));
}

function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function diffDays(isoA, isoB) {
  return Math.round((new Date(isoB + "T00:00:00") - new Date(isoA + "T00:00:00")) / 86400000);
}
function diaSemanaCurto(iso) {
  const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  return dias[new Date(iso + "T00:00:00").getDay()];
}
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function normalizeText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function diceSimilarity(a, b) {
  const s1 = normalizeText(a);
  const s2 = normalizeText(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 3 || s2.length < 3) return s1 === s2 ? 1 : 0;
  const pairs = (s) => {
    const compact = s.replace(/\s+/g, " ");
    const out = [];
    for (let i = 0; i < compact.length - 1; i++) out.push(compact.slice(i, i + 2));
    return out;
  };
  const left = pairs(s1);
  const right = pairs(s2);
  const counts = new Map();
  right.forEach((pair) => counts.set(pair, (counts.get(pair) || 0) + 1));
  let hits = 0;
  left.forEach((pair) => {
    const count = counts.get(pair) || 0;
    if (count > 0) {
      hits++;
      counts.set(pair, count - 1);
    }
  });
  return (2 * hits) / (left.length + right.length);
}

function tokenOverlap(a, b) {
  const left = new Set(normalizeText(a).split(" ").filter(Boolean));
  const right = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  let hits = 0;
  left.forEach((token) => {
    if (right.has(token)) hits++;
  });
  return hits / Math.max(left.size, right.size);
}

function textSimilarity(a, b) {
  return Math.max(diceSimilarity(a, b), tokenOverlap(a, b));
}

function findCatalogMatch(item, livros) {
  const desiredTitle = normalizeText(item.titulo);
  const desiredAuthor = normalizeText(item.autor);
  if (!desiredTitle) return null;

  let best = null;
  for (const livro of livros) {
    const title = normalizeText(livro.titulo);
    const author = normalizeText(livro.autor);
    if (!title) continue;

    const titleScore = textSimilarity(desiredTitle, title);
    const shorter = Math.min(desiredTitle.length, title.length);
    const longer = Math.max(desiredTitle.length, title.length) || 1;
    const contained = (title.includes(desiredTitle) || desiredTitle.includes(title)) && shorter / longer >= 0.72;
    const titleMatch = titleScore >= 0.84 || contained;
    if (!titleMatch) continue;

    let authorScore = 1;
    if (desiredAuthor && author) {
      authorScore = textSimilarity(desiredAuthor, author);
      const authorContained = author.includes(desiredAuthor) || desiredAuthor.includes(author);
      if (authorScore < 0.58 && !authorContained) continue;
    }

    const score = titleScore * 0.78 + authorScore * 0.22;
    if (!best || score > best.score) best = { livro, score };
  }
  return best?.livro || null;
}

/* =========================================================================
   SEED DATA
   ========================================================================= */
const SEED_USERS = [
  { cpf: "111.111.111-11", nome: "Veruska Ferreira", email: "veruska@exemplo.com", telefone: "(83) 99111-1111", perfil: "leitor", senha: "1234" },
  { cpf: "222.222.222-22", nome: "Jonas Amorim", email: "jonas@exemplo.com", telefone: "(83) 99222-2222", perfil: "administrador", senha: "1234" },
];

const SEED_TITULOS = [
  { id: "L1", isbn: "978-85-3263-4214", titulo: "10 lições sobre Kant", autor: "Flamarion Tavares Leite", ano: "2012", edicao: "1ª", editora: "Zahar", local: "Estante A1", paginas: "120", generos: ["Filosofia"], foto: null, nota: 0, comentario: "" },
  { id: "L2", isbn: "978-85-7860-9313", titulo: "12 Homens Extraordinariamente Comuns", autor: "John MacArthur", ano: "2003", edicao: "2ª", editora: "Vida", local: "Estante B2", paginas: "220", generos: ["Teologia"], foto: null, nota: 0, comentario: "" },
  { id: "L3", isbn: "978-85-5080-2756", titulo: "12 Regras para a Vida", autor: "Jordan B. Peterson", ano: "2018", edicao: "1ª", editora: "Alta Cult", local: "Estante A3", paginas: "412", generos: ["Autoajuda"], foto: null, nota: 0, comentario: "" },
  { id: "L4", isbn: "978-85-6247-8697", titulo: "A Busca da Santidade", autor: "Jerry Bridges", ano: "1999", edicao: "3ª", editora: "Fiel", local: "Estante B1", paginas: "210", generos: ["Teologia"], foto: null, nota: 4, comentario: "Leitura densa, mas muito proveitosa." },
  { id: "L5", isbn: "978-65-8621-7346", titulo: "A Crise da Cultura e a Ordem do Amor", autor: "Victor Sales Pinheiro", ano: "2021", edicao: "1ª", editora: "VIDE", local: "Estante C1", paginas: "180", generos: ["Filosofia", "Teologia"], foto: null, nota: 5, comentario: "" },
  { id: "L6", isbn: "978-85-1234-0001", titulo: "Ego Transformado", autor: "T. Keller", ano: "2015", edicao: "1ª", editora: "Vida Nova", local: "Estante B3", paginas: "160", generos: ["Teologia"], foto: null, nota: 0, comentario: "" },
  { id: "L7", isbn: "978-85-1234-0002", titulo: "O Drama das Escrituras", autor: "C. Bartholomew", ano: "2014", edicao: "1ª", editora: "Vida Nova", local: "Estante B4", paginas: "320", generos: ["Teologia"], foto: null, nota: 0, comentario: "" },
  { id: "L8", isbn: "978-85-1234-0003", titulo: "Deuses Falsos", autor: "T. Keller", ano: "2013", edicao: "2ª", editora: "Vida Nova", local: "Estante B5", paginas: "240", generos: ["Teologia"], foto: null, nota: 3, comentario: "Reler trechos sobre dinheiro." },
  { id: "L9", isbn: "978-85-1234-0004", titulo: "O Homem Mais Rico da Babilônia", autor: "George S. Clason", ano: "1926", edicao: "5ª", editora: "Harper Collins", local: "Estante D1", paginas: "144", generos: ["Finanças"], foto: null, nota: 0, comentario: "" },
];

const SEED_EXEMPLARES = [
  { id: "EX1", tituloId: "L1", tombo: "T-0001", estadoConservacao: "Regular", status: "Disponível", emprestimoAtualId: null, motivoIndisponivel: null, historico: [] },
  { id: "EX2", tituloId: "L2", tombo: "T-0002", estadoConservacao: "Bom",     status: "Disponível", emprestimoAtualId: null, motivoIndisponivel: null, historico: [] },
  { id: "EX3", tituloId: "L3", tombo: "T-0003", estadoConservacao: "Bom",     status: "Disponível", emprestimoAtualId: null, motivoIndisponivel: null, historico: [] },
  { id: "EX4", tituloId: "L4", tombo: "T-0004", estadoConservacao: "Regular", status: "Disponível", emprestimoAtualId: null, motivoIndisponivel: null, historico: [] },
  { id: "EX5", tituloId: "L5", tombo: "T-0005", estadoConservacao: "Bom",     status: "Disponível", emprestimoAtualId: null, motivoIndisponivel: null, historico: [] },
  { id: "EX6", tituloId: "L6", tombo: "T-0006", estadoConservacao: "Bom",     status: "Emprestado", emprestimoAtualId: "E1",  motivoIndisponivel: null, historico: [] },
  { id: "EX7", tituloId: "L7", tombo: "T-0007", estadoConservacao: "Regular", status: "Emprestado", emprestimoAtualId: "E2",  motivoIndisponivel: null, historico: [] },
  { id: "EX8", tituloId: "L8", tombo: "T-0008", estadoConservacao: "Bom",     status: "Emprestado", emprestimoAtualId: "E3",  motivoIndisponivel: null, historico: [] },
  { id: "EX9", tituloId: "L9", tombo: "T-0009", estadoConservacao: "Bom",     status: "Disponível", emprestimoAtualId: null, motivoIndisponivel: null, historico: [] },
];

const SEED_EMPRESTIMOS = [
  { id: "E1",  exemplarId: "EX6", locatario: "Veruska FB",   locatarioCpf: "11111111111", dataEmprestimo: addDays(todayISO(), -32), dataDevolucao: addDays(todayISO(), 1),   status: "Ativo",     observacoes: "Indicação",              renovacao: null },
  { id: "E2",  exemplarId: "EX7", locatario: "Jonas Amorim", locatarioCpf: "22222222222", dataEmprestimo: addDays(todayISO(), -45), dataDevolucao: addDays(todayISO(), -29), status: "Atrasado",  observacoes: "Pág 26, 56 a 64 riscos do dono", renovacao: null },
  { id: "E3",  exemplarId: "EX8", locatario: "Vanessa",      locatarioCpf: null,          dataEmprestimo: addDays(todayISO(), -45), dataDevolucao: addDays(todayISO(), -29), status: "Atrasado",  observacoes: "Discipulado",            renovacao: null },
  { id: "E4",  exemplarId: "EX9", locatario: "Jonas",        locatarioCpf: null,          dataEmprestimo: addDays(todayISO(), -60), dataDevolucao: addDays(todayISO(), -46), dataDevolucaoEfetiva: addDays(todayISO(), -48), status: "Devolvido", observacoes: "Discipulado", renovacao: null },
  { id: "H1",  exemplarId: "EX3", locatario: "Veruska FB",   locatarioCpf: "11111111111", dataEmprestimo: addDays(todayISO(), -88), dataDevolucao: addDays(todayISO(), -74), dataDevolucaoEfetiva: addDays(todayISO(), -75), status: "Devolvido", observacoes: "", renovacao: null },
  { id: "H2",  exemplarId: "EX1", locatario: "Jonas Amorim", locatarioCpf: "22222222222", dataEmprestimo: addDays(todayISO(), -80), dataDevolucao: addDays(todayISO(), -66), dataDevolucaoEfetiva: addDays(todayISO(), -60), status: "Devolvido", observacoes: "", renovacao: null },
  { id: "H3",  exemplarId: "EX4", locatario: "Vanessa",      locatarioCpf: null,          dataEmprestimo: addDays(todayISO(), -75), dataDevolucao: addDays(todayISO(), -61), dataDevolucaoEfetiva: addDays(todayISO(), -62), status: "Devolvido", observacoes: "", renovacao: null },
  { id: "H4",  exemplarId: "EX2", locatario: "Veruska FB",   locatarioCpf: "11111111111", dataEmprestimo: addDays(todayISO(), -70), dataDevolucao: addDays(todayISO(), -56), dataDevolucaoEfetiva: addDays(todayISO(), -50), status: "Devolvido", observacoes: "", renovacao: null },
  { id: "H5",  exemplarId: "EX5", locatario: "Marcos Lima",  locatarioCpf: null,          dataEmprestimo: addDays(todayISO(), -65), dataDevolucao: addDays(todayISO(), -51), dataDevolucaoEfetiva: addDays(todayISO(), -52), status: "Devolvido", observacoes: "", renovacao: null },
  { id: "H6",  exemplarId: "EX6", locatario: "Jonas Amorim", locatarioCpf: "22222222222", dataEmprestimo: addDays(todayISO(), -55), dataDevolucao: addDays(todayISO(), -41), dataDevolucaoEfetiva: addDays(todayISO(), -38), status: "Devolvido", observacoes: "", renovacao: null },
  { id: "H7",  exemplarId: "EX7", locatario: "Vanessa",      locatarioCpf: null,          dataEmprestimo: addDays(todayISO(), -50), dataDevolucao: addDays(todayISO(), -36), dataDevolucaoEfetiva: addDays(todayISO(), -36), status: "Devolvido", observacoes: "", renovacao: null },
  { id: "H8",  exemplarId: "EX1", locatario: "Marcos Lima",  locatarioCpf: null,          dataEmprestimo: addDays(todayISO(), -42), dataDevolucao: addDays(todayISO(), -28), dataDevolucaoEfetiva: addDays(todayISO(), -20), status: "Devolvido", observacoes: "", renovacao: null },
  { id: "H9",  exemplarId: "EX3", locatario: "Jonas",        locatarioCpf: null,          dataEmprestimo: addDays(todayISO(), -35), dataDevolucao: addDays(todayISO(), -21), dataDevolucaoEfetiva: addDays(todayISO(), -22), status: "Devolvido", observacoes: "", renovacao: null },
  { id: "H10", exemplarId: "EX8", locatario: "Veruska FB",   locatarioCpf: "11111111111", dataEmprestimo: addDays(todayISO(), -28), dataDevolucao: addDays(todayISO(), -14), dataDevolucaoEfetiva: addDays(todayISO(), -10), status: "Devolvido", observacoes: "", renovacao: null },
];

const SEED_ANOTACOES = [
  { id: "A1", livroId: "L8", titulo: "Deuses falsos", nota: 3, texto: "Pág 35,36 e 44 riscadas pelo dono", data: new Date(Date.now() - 86400000 * 3).toISOString() },
];

/* helpers de disponibilidade */
function getDisponibilidadeTitulo(tituloId, exemplares) {
  return exemplares.filter((e) => e.tituloId === tituloId && e.status === "Disponível").length;
}
function getStatusTitulo(tituloId, exemplares) {
  const exs = exemplares.filter((e) => e.tituloId === tituloId);
  if (!exs.length) return "Sem exemplares";
  if (exs.some((e) => e.status === "Disponível")) return "Disponível";
  if (exs.some((e) => e.status === "Emprestado")) return "Emprestado";
  return "Indisponível";
}
function getTituloFromEmprestimo(emp, exemplares, titulos) {
  const ex = exemplares.find((x) => x.id === emp.exemplarId);
  return titulos.find((t) => t.id === ex?.tituloId) || null;
}

const SEED_CONFIG_NOTIF = [
  { id: "reserva", nome: "Reserva confirmada", destinatario: "Locatário", horario: "09:00", gatilho: "No registro do empréstimo", texto: "Olá {nome_locatario}! Reservamos o livro \"{nome_livro}\" para você. Devolução prevista: {data_devolucao}." },
  { id: "lembrete", nome: "Lembrete de devolução próxima", destinatario: "Locatário", horario: "09:00", gatilho: "3 dias antes do vencimento", texto: "Oi {nome_locatario}, o prazo de devolução do livro \"{nome_livro}\" vence em breve: {data_devolucao}." },
  { id: "vencimento", nome: "Aviso de vencimento no dia", destinatario: "Locatário", horario: "08:00", gatilho: "No dia do vencimento", texto: "{nome_locatario}, hoje é o dia de devolver \"{nome_livro}\". Combinamos {data_devolucao}." },
  { id: "cobranca", nome: "Cobrança diária de atraso", destinatario: "Locatário", horario: "10:00", gatilho: "Diariamente após o vencimento", texto: "{nome_locatario}, o livro \"{nome_livro}\" está atrasado desde {data_devolucao}. Por favor, providencie a devolução." },
];

/* =========================================================================
   GENERIC UI PRIMITIVES
   ========================================================================= */
function Badge({ children, tone = "neutral" }) {
  const tones = {
    success: { bg: COLORS.successBg, fg: COLORS.success },
    warn: { bg: COLORS.warnBg, fg: COLORS.warn },
    danger: { bg: COLORS.dangerBg, fg: COLORS.danger },
    neutral: { bg: COLORS.bgAlt, fg: COLORS.neutral },
    accent: { bg: COLORS.accentLight, fg: COLORS.accent },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      background: t.bg, color: t.fg, fontSize: 12, fontWeight: 600,
      padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap",
      fontFamily: "Inter, sans-serif", letterSpacing: 0.2,
    }}>{children}</span>
  );
}

function Stars({ value, onChange, size = 18 }) {
  const [hover, setHover] = useState(null);
  const interactive = !!onChange;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover ?? value) >= n;
        return (
          <Star
            key={n}
            size={size}
            style={{ cursor: interactive ? "pointer" : "default" }}
            fill={filled ? COLORS.accent : "none"}
            color={filled ? COLORS.accent : COLORS.neutral}
            onMouseEnter={() => interactive && setHover(n)}
            onMouseLeave={() => interactive && setHover(null)}
            onClick={() => interactive && onChange(n === value ? 0 : n)}
          />
        );
      })}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", icon: Icon, type = "button", style, disabled, title }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center",
    fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14,
    borderRadius: 10, padding: "10px 16px", cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", transition: "all .15s ease", opacity: disabled ? 0.55 : 1,
  };
  const variants = {
    primary: { background: COLORS.primary, color: "#fff" },
    accent: { background: COLORS.accent, color: "#fff" },
    ghost: { background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` },
    subtle: { background: COLORS.bgAlt, color: COLORS.ink },
    danger: { background: "transparent", color: COLORS.danger, border: `1px solid ${COLORS.dangerBg}` },
    icon: { background: "transparent", color: COLORS.neutral, padding: 8, border: `1px solid ${COLORS.border}` },
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
        {label}{required && <span style={{ color: COLORS.accent }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
  fontFamily: "Inter, sans-serif", fontSize: 14, color: COLORS.ink, background: "#fff",
  boxSizing: "border-box", outline: "none",
};

function Input(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function Textarea(props) {
  return <textarea {...props} style={{ ...inputStyle, minHeight: 80, resize: "vertical", ...(props.style || {}) }} />;
}
function Select({ children, ...props }) {
  return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>{children}</select>;
}

function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(28,25,23,0.45)", zIndex: 1000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: COLORS.card, width: "100%", maxWidth: width, maxHeight: "92vh", overflowY: "auto",
        borderRadius: "20px 20px 0 0", padding: 24, boxShadow: "0 -8px 30px rgba(0,0,0,0.15)",
        fontFamily: "Inter, sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 22, color: COLORS.primaryDark }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.neutral }}>
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: COLORS.neutral }}>
      <Icon size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 15 }}>{text}</div>
    </div>
  );
}

function Confirm({ text, onConfirm, onCancel }) {
  return (
    <Modal title="Confirmar ação" onClose={onCancel} width={380}>
      <p style={{ fontFamily: "Inter, sans-serif", color: COLORS.ink, marginTop: 0 }}>{text}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="danger" onClick={onConfirm} style={{ background: COLORS.danger, color: "#fff", border: "none" }}>Confirmar</Btn>
      </div>
    </Modal>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: COLORS.primaryDark, color: "#fff", padding: "12px 20px", borderRadius: 12,
      fontFamily: "Inter, sans-serif", fontSize: 14, zIndex: 2000, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      display: "flex", alignItems: "center", gap: 8, maxWidth: "90vw",
    }}>
      <Bell size={16} />
      {toast}
    </div>
  );
}

/* =========================================================================
   APP ROOT
   ========================================================================= */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center",
          justifyContent: "center", padding: 24, fontFamily: "Inter, sans-serif",
        }}>
          <div style={{ maxWidth: 460, background: "#fff", border: `1px solid ${COLORS.danger}`, borderRadius: 14, padding: 24 }}>
            <h2 style={{ color: COLORS.danger, fontFamily: "'Source Serif 4', serif", marginTop: 0 }}>Algo deu errado</h2>
            <p style={{ fontSize: 13, color: COLORS.ink }}>{String(this.state.error?.message || this.state.error)}</p>
            <button
              onClick={async () => {
                const keys = ["usuarios", "titulos", "exemplares", "emprestimos", "solicitacoes", "listaEspera", "leituras", "anotacoes", "notifLog", "configNotif", "renovacoes", "posts", "grupos", "sugestoes", "auth"];
                for (const k of keys) { try { await deleteKey(k); } catch {} }
                await deleteKeysByPrefix("desejos:");
                window.location.reload();
              }}
              style={{ marginTop: 12, background: COLORS.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
            >
              Resetar dados e recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  useFonts();
  const [booted, setBooted] = useState(false);
  const [auth, setAuth] = useState(null); // {cpf, nome, perfil}
  const [usuarios, setUsuarios] = useState(SEED_USERS);
  const [titulos, setTitulos] = useState(SEED_TITULOS);
  const [exemplares, setExemplares] = useState(SEED_EXEMPLARES);
  const [emprestimos, setEmprestimos] = useState(SEED_EMPRESTIMOS);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [listaEspera, setListaEspera] = useState([]);
  const [leituras, setLeituras] = useState([]);
  const [anotacoes, setAnotacoes] = useState(SEED_ANOTACOES);
  const [notifLog, setNotifLog] = useState([]);
  const [configNotif, setConfigNotif] = useState(SEED_CONFIG_NOTIF);
  const [renovacoes, setRenovacoes] = useState([]);
  const [sugestoes, setSugestoes] = useState([]);
  const [posts, setPosts] = useState([
    { id: "P1", autor: "Jonas Amorim", texto: "Terminei \"Deuses Falsos\" essa semana — recomendo demais para quem quer entender ídolos modernos.", data: new Date(Date.now() - 86400000).toISOString(), likes: ["Veruska FB"], comentarios: [{ autor: "Veruska FB", texto: "Já está na minha fila!", data: new Date(Date.now() - 80000000).toISOString() }] },
  ]);
  const [grupos, setGrupos] = useState([
    { id: "G1", nome: "Clube de Teologia", descricao: "Discussões sobre os livros teológicos do acervo.", membros: ["Jonas Amorim"], posts: [] },
  ]);
  const [desejos, setDesejos] = useState([]);
  const [route, setRoute] = useState("painel");
  const [routeParams, setRouteParams] = useState({});
  const [toast, setToast] = useState(null);

  // Load persisted state once
  useEffect(() => {
    (async () => {
      const [u, tit, exs, e, sol, le2, le, an, nl, cn, rv, ps, gp, sug, a] = await Promise.all([
        loadKey("usuarios", null),
        loadKey("titulos", null),
        loadKey("exemplares", null),
        loadKey("emprestimos", null),
        loadKey("solicitacoes", null),
        loadKey("listaEspera", null),
        loadKey("leituras", null),
        loadKey("anotacoes", null),
        loadKey("notifLog", null),
        loadKey("configNotif", null),
        loadKey("renovacoes", null),
        loadKey("posts", null),
        loadKey("grupos", null),
        loadKey("sugestoes", null),
        loadKey("auth", null),
      ]);
      if (u && Array.isArray(u) && u.length > 0 && u[0]?.cpf) setUsuarios(u);
      if (tit) setTitulos(tit);
      if (exs) setExemplares(exs);
      if (e) setEmprestimos(e);
      if (sol) setSolicitacoes(sol);
      if (le2) setListaEspera(le2);
      if (le) setLeituras(le);
      if (an) setAnotacoes(an);
      if (nl) setNotifLog(nl);
      if (cn) setConfigNotif(cn);
      if (rv) setRenovacoes(rv);
      if (ps) setPosts(ps);
      if (gp) setGrupos(gp);
      if (sug) setSugestoes(sug);
      if (a && a.cpf && a.perfil && a.nome) setAuth(a);
      setBooted(true);
    })();
  }, []);

  // Persist on change (after initial boot)
  useEffect(() => { if (booted) saveKey("usuarios", usuarios); }, [usuarios, booted]);
  useEffect(() => { if (booted) saveKey("titulos", titulos); }, [titulos, booted]);
  useEffect(() => { if (booted) saveKey("exemplares", exemplares); }, [exemplares, booted]);
  useEffect(() => { if (booted) saveKey("emprestimos", emprestimos); }, [emprestimos, booted]);
  useEffect(() => { if (booted) saveKey("solicitacoes", solicitacoes); }, [solicitacoes, booted]);
  useEffect(() => { if (booted) saveKey("listaEspera", listaEspera); }, [listaEspera, booted]);
  useEffect(() => { if (booted) saveKey("leituras", leituras); }, [leituras, booted]);
  useEffect(() => { if (booted) saveKey("anotacoes", anotacoes); }, [anotacoes, booted]);
  useEffect(() => { if (booted) saveKey("notifLog", notifLog); }, [notifLog, booted]);
  useEffect(() => { if (booted) saveKey("configNotif", configNotif); }, [configNotif, booted]);
  useEffect(() => { if (booted) saveKey("renovacoes", renovacoes); }, [renovacoes, booted]);
  useEffect(() => { if (booted) saveKey("posts", posts); }, [posts, booted]);
  useEffect(() => { if (booted) saveKey("grupos", grupos); }, [grupos, booted]);
  useEffect(() => { if (booted) saveKey("sugestoes", sugestoes); }, [sugestoes, booted]);
  useEffect(() => { if (booted) saveKey("auth", auth); }, [auth, booted]);

  useEffect(() => {
    if (!booted || !auth?.cpf) {
      setDesejos([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const keys = await listKeys(`desejos:${auth.cpf}:`);
      const items = (await Promise.all(keys.map((key) => loadKey(key, null))))
        .filter(Boolean)
        .sort((a, b) => String(b.dataAdicionado || "").localeCompare(String(a.dataAdicionado || "")));
      if (!cancelled) setDesejos(items);
    })();
    return () => { cancelled = true; };
  }, [booted, auth?.cpf]);

  // Auto-update overdue loans whenever boot changes
  useEffect(() => {
    if (!booted) return;
    const today = todayISO();
    setEmprestimos((prev) => prev.map((e) => {
      if (e.status === "Ativo" && e.dataDevolucao < today) return { ...e, status: "Atrasado" };
      return e;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  const showToast = useCallback((msg, ms = 2800) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  // Simulated WhatsApp/SMS messaging log
  const sendNotif = useCallback((tipo, destinatario, texto) => {
    setNotifLog((prev) => [
      { id: uid("ntf"), tipo, destinatario, texto, canal: "WhatsApp Business (simulado) · fallback SMS", data: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  function logout() {
    setAuth(null);
    setRoute("painel");
    setRouteParams({});
  }

  function navigate(nextRoute, params = {}) {
    setRoute(nextRoute);
    setRouteParams(params);
  }

  function desejoKey(id) {
    return `desejos:${auth.cpf}:${id}`;
  }

  async function addDesejo(data) {
    const titulo = (data.titulo || "").trim();
    const autor = (data.autor || "").trim();
    if (!titulo) return false;
    const duplicated = desejos.some((item) => {
      const sameTitle = normalizeText(item.titulo) === normalizeText(titulo);
      const sameAuthor = normalizeText(item.autor) === normalizeText(autor);
      return sameTitle && (sameAuthor || !item.autor || !autor);
    });
    if (duplicated) {
      showToast("Este livro ja esta na sua lista de desejos.");
      return false;
    }
    const item = {
      id: uid("D"),
      titulo,
      autor,
      capaUrl: data.capaUrl || null,
      origem: data.origem === "google_books" ? "google_books" : "manual",
      dataAdicionado: new Date().toISOString(),
    };
    await saveKey(desejoKey(item.id), item);
    setDesejos((prev) => [item, ...prev]);
    showToast("Livro adicionado a lista de desejos.");
    return true;
  }

  async function removeDesejo(id) {
    await deleteKey(desejoKey(id));
    setDesejos((prev) => prev.filter((item) => item.id !== id));
    showToast("Livro removido da lista de desejos.");
  }

  if (!booted) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 400, background: COLORS.bg, fontFamily: "Inter, sans-serif", color: COLORS.neutral }}>
        Carregando...
      </div>
    );
  }

  if (!auth) {
    return <LoginScreen usuarios={usuarios} setUsuarios={setUsuarios} onLogin={setAuth} sendNotif={sendNotif} showToast={showToast} />;
  }

  const ctx = {
    auth, usuarios, setUsuarios,
    setAuth,
    titulos, setTitulos,
    exemplares, setExemplares,
    emprestimos, setEmprestimos,
    solicitacoes, setSolicitacoes,
    listaEspera, setListaEspera,
    leituras, setLeituras,
    anotacoes, setAnotacoes,
    notifLog, sendNotif,
    configNotif, setConfigNotif,
    renovacoes, setRenovacoes,
    posts, setPosts,
    grupos, setGrupos,
    sugestoes, setSugestoes,
    desejos, addDesejo, removeDesejo,
    routeParams,
    showToast,
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", fontFamily: "Inter, sans-serif", color: COLORS.ink }}>
      <style>{`
        * { box-sizing: border-box; }
        ::placeholder { color: ${COLORS.neutral}; opacity: 0.7; }
        button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
          outline: 2px solid ${COLORS.accent}; outline-offset: 1px;
        }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>
      <Shell route={route} setRoute={navigate} auth={auth} onLogout={logout}>
        <Router route={route} setRoute={navigate} ctx={ctx} />
      </Shell>
      <Toast toast={toast} />
    </div>
  );
}

/* =========================================================================
   SHELL: responsive nav (bottom bar on mobile, sidebar on desktop)
   ========================================================================= */
const NAV_ITEMS = [
  { key: "painel", label: "Início", icon: Home },
  { key: "livros", label: "Livros", icon: BookOpen },
  { key: "emprestimos", label: "Empréstimos", icon: RefreshCw },
  { key: "leitura", label: "Leitura", icon: BookMarked },
  { key: "desejos", label: "Desejos", icon: Heart },
  { key: "minhabiblioteca", label: "Minha Biblioteca", icon: Bookmark },
  { key: "anotacoes", label: "Anotações", icon: StickyNote },
  { key: "comunidade", label: "Comunidade", icon: UsersRound },
];
const ADMIN_ITEMS = [
  { key: "usuarios", label: "Usuários", icon: UsersRound },
  { key: "renovacoes", label: "Renovações", icon: RefreshCw },
  { key: "notificacoes", label: "Notificações", icon: Settings },
  { key: "log", label: "Log de mensagens", icon: Bell },
];

function Shell({ route, setRoute, auth, onLogout, children }) {
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth >= 880 : true);
  useEffect(() => {
    function onResize() { setIsDesktop(window.innerWidth >= 880); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const items = auth.perfil === "administrador" ? [...NAV_ITEMS, ...ADMIN_ITEMS.map((i) => ({ ...i, admin: true }))] : NAV_ITEMS;
  const bottomItems = NAV_ITEMS; // mobile bottom bar stays compact regardless of profile

  return (
    <div style={{ display: "flex", minHeight: "100%" }}>
      {isDesktop && (
        <aside style={{
          width: 232, flexShrink: 0, background: COLORS.primaryDark, color: "#fff",
          padding: "24px 16px", display: "flex", flexDirection: "column", minHeight: "100vh",
          position: "sticky", top: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "0 8px" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <BookOpen size={20} color="#fff" />
            </div>
            <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 18, lineHeight: 1.1 }}>Acervo Vivo</div>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            {items.map((it) => (
              <NavLink key={it.key} item={it} active={route === it.key} onClick={() => setRoute(it.key)} />
            ))}
          </nav>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 14, marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <UserMenu
                auth={auth}
                placement="top"
                onProfile={() => setRoute("perfil")}
                onLogout={onLogout}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{auth.nome}</div>
                <div style={{ fontSize: 11, opacity: 0.7, textTransform: "capitalize" }}>{auth.perfil}</div>
              </div>
            </div>
          </div>
        </aside>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!isDesktop && (
          <header style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", background: COLORS.primaryDark, color: "#fff", position: "sticky", top: 0, zIndex: 50,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={20} color={COLORS.accent} />
              <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 17 }}>Acervo Vivo</span>
            </div>
            <UserMenu
              auth={auth}
              placement="bottom"
              align="right"
              onProfile={() => setRoute("perfil")}
              onLogout={onLogout}
            />
          </header>
        )}

        <main style={{ flex: 1, padding: isDesktop ? "28px 32px 40px" : "16px 14px 90px", maxWidth: 980, width: "100%", margin: "0 auto" }}>
          {!isDesktop && auth.perfil === "administrador" && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
              {ADMIN_ITEMS.map((it) => (
                <button key={it.key} onClick={() => setRoute(it.key)} style={{
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  border: `1px solid ${route === it.key ? COLORS.primary : COLORS.border}`,
                  background: route === it.key ? COLORS.primary : "#fff", color: route === it.key ? "#fff" : COLORS.ink,
                  padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  <it.icon size={13} /> {it.label}
                </button>
              ))}
            </div>
          )}
          {children}
        </main>

        {!isDesktop && (
          <nav style={{
            position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff",
            borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-around",
            padding: "8px 4px 10px", zIndex: 60,
          }}>
            {bottomItems.map((it) => {
              const active = route === it.key;
              return (
                <button key={it.key} onClick={() => setRoute(it.key)} style={{
                  background: "none", border: "none", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3, color: active ? COLORS.primary : COLORS.neutral, cursor: "pointer",
                  fontSize: 10, fontFamily: "Inter, sans-serif", padding: "2px 2px", flex: "1 1 0", minWidth: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  <it.icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  {it.label}
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

function Avatar({ user, size = 36 }) {
  const initial = (user?.nome || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden",
      background: COLORS.accentLight, color: COLORS.primaryDark, border: "2px solid rgba(255,255,255,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: Math.max(14, Math.round(size * 0.45)),
      flexShrink: 0,
    }}>
      {user?.foto ? (
        <img src={user.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function UserMenu({ auth, onProfile, onLogout, placement = "bottom", align = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(action) {
    setOpen(false);
    action();
  }

  const menuPosition = placement === "top" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" };
  const menuAlign = align === "right" ? { right: 0 } : { left: 0 };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Menu do usuário"
        style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Avatar user={auth} />
      </button>

      {open && (
        <div style={{
          position: "absolute", ...menuPosition, ...menuAlign, zIndex: 100,
          width: 178, background: COLORS.bg, color: COLORS.ink, border: `1px solid ${COLORS.border}`,
          borderRadius: 8, boxShadow: "0 12px 30px rgba(28,25,23,0.18)", padding: 6,
          fontFamily: "Inter, sans-serif",
        }}>
          <button
            type="button"
            onClick={() => choose(onProfile)}
            style={{
              width: "100%", border: "none", background: "transparent", color: COLORS.ink,
              padding: "9px 10px", borderRadius: 6, cursor: "pointer", display: "flex",
              alignItems: "center", gap: 8, fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "left",
            }}
          >
            <User size={15} /> Meu perfil
          </button>
          <button
            type="button"
            onClick={() => choose(onLogout)}
            style={{
              width: "100%", border: "none", background: "transparent", color: COLORS.danger,
              padding: "9px 10px", borderRadius: 6, cursor: "pointer", display: "flex",
              alignItems: "center", gap: 8, fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "left",
            }}
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

function NavLink({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
      background: active ? "rgba(255,255,255,0.12)" : "transparent", border: "none", cursor: "pointer",
      color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: active ? 600 : 500, textAlign: "left",
    }}>
      <Icon size={17} color={active ? "#fff" : "rgba(255,255,255,0.65)"} />
      {item.label}
      {item.admin && <Shield size={12} style={{ marginLeft: "auto", opacity: 0.6 }} />}
    </button>
  );
}

function Router({ route, setRoute, ctx }) {
  const isAdmin = ctx.auth.perfil === "administrador";
  switch (route) {
    case "painel": return <PainelScreen ctx={ctx} setRoute={setRoute} />;
    case "livros": return <LivrosScreen ctx={ctx} />;
    case "emprestimos": return <EmprestimosScreen ctx={ctx} />;
    case "leitura": return <LeituraScreen ctx={ctx} />;
    case "desejos": return <ListaDesejosScreen ctx={ctx} setRoute={setRoute} />;
    case "minhabiblioteca": return <MinhaBibliotecaScreen ctx={ctx} />;
    case "anotacoes": return <AnotacoesScreen ctx={ctx} />;
    case "comunidade": return <ComunidadeScreen ctx={ctx} />;
    case "perfil": return <PerfilScreen ctx={ctx} />;
    case "usuarios": return isAdmin ? <GestaoUsuariosScreen ctx={ctx} /> : <Negado />;
    case "renovacoes": return isAdmin ? <RenovacoesAdminScreen ctx={ctx} /> : <Negado />;
    case "notificacoes": return isAdmin ? <NotificacoesConfigScreen ctx={ctx} /> : <Negado />;
    case "log": return isAdmin ? <NotifLogScreen ctx={ctx} /> : <Negado />;
    default: return <PainelScreen ctx={ctx} setRoute={setRoute} />;
  }
}
function Negado() {
  return <EmptyState icon={ShieldCheck} text="Acesso restrito ao perfil Administrador." />;
}

/* =========================================================================
   SCREEN: LOGIN — CPF + senha, depois 2FA simulado
   ========================================================================= */
function senhaForte(s) {
  return {
    min8: s.length >= 8,
    upper: /[A-Z]/.test(s),
    lower: /[a-z]/.test(s),
    digit: /[0-9]/.test(s),
    special: /[^A-Za-z0-9]/.test(s),
  };
}

function LoginScreen({ usuarios, setUsuarios, onLogin, sendNotif, showToast }) {
  useFonts();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [stage, setStage] = useState("credenciais");
  const [pendingUser, setPendingUser] = useState(null);
  const [token, setToken] = useState(null);
  const [tokenInput, setTokenInput] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [tokenErro, setTokenErro] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState("");

  useEffect(() => {
    if (stage !== "token" || !expiresAt) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
    }, 250);
    return () => clearInterval(t);
  }, [stage, expiresAt]);

  function generateToken(user) {
    const tk = String(Math.floor(100000 + Math.random() * 900000));
    setToken(tk);
    setExpiresAt(Date.now() + 60000);
    setSecondsLeft(60);
    sendNotif("2FA", user.telefone, `Seu código de verificação Acervo Vivo é ${tk}. Válido por 60 segundos.`);
  }

  function onlyDigits(s) { return (s || "").replace(/\D/g, ""); }

  function submitCredenciais(e) {
    e.preventDefault();
    try {
      const lista = Array.isArray(usuarios) ? usuarios : [];
      const user = lista.find((u) => onlyDigits(u.cpf) === onlyDigits(cpf));
      if (!user) {
        setErro("CPF não encontrado. Verifique se digitou corretamente (ex: 111.111.111-11).");
        return;
      }
      if (user.ativo === false) {
        setErro("Esta conta está inativa. Entre em contato com o administrador.");
        return;
      }
      if (user.pendingSenha) {
        setErro("");
        setPendingUser(user);
        setStage("definirSenha");
        return;
      }
      if (user.senha !== senha) {
        setErro("Senha incorreta.");
        return;
      }
      setErro("");
      setPendingUser(user);
      generateToken(user);
      setStage("token");
    } catch (err) {
      setErro("Ocorreu um erro inesperado ao entrar: " + (err?.message || String(err)));
    }
  }

  function submitToken(e) {
    e.preventDefault();
    if (secondsLeft <= 0) {
      setTokenErro("Token expirado. Solicite o reenvio.");
      return;
    }
    if (tokenInput.trim() !== token) {
      setTokenErro("Token incorreto. Verifique e tente novamente.");
      return;
    }
    onLogin({
      cpf: pendingUser.cpf,
      nome: pendingUser.nome,
      perfil: pendingUser.perfil,
      telefone: pendingUser.telefone,
      email: pendingUser.email,
      foto: pendingUser.foto || null,
    });
  }

  function resend() {
    generateToken(pendingUser);
    setTokenInput("");
    setTokenErro("");
    showToast("Novo token enviado (simulado).");
  }

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.primaryDark, display: "flex", alignItems: "center",
      justifyContent: "center", padding: 20, fontFamily: "Inter, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: COLORS.accent, display: "flex",
            alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
          }}>
            <BookOpen size={28} color="#fff" />
          </div>
          <h1 style={{ color: "#fff", fontFamily: "'Source Serif 4', serif", fontSize: 28, margin: 0 }}>Acervo Vivo</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", marginTop: 6, fontSize: 14 }}>Gestão de biblioteca pessoal</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 18, padding: 28, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
          {stage === "definirSenha" ? (() => {
            const criterios = senhaForte(novaSenha);
            const aprovado = Object.values(criterios).every(Boolean);
            const forca = Object.values(criterios).filter(Boolean).length;
            const corForca = forca <= 2 ? COLORS.danger : forca <= 3 ? COLORS.warn : forca === 4 ? "#B8841E" : COLORS.success;
            const labelForca = ["", "Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][forca];

            function submitDefinirSenha(e) {
              e.preventDefault();
              if (!aprovado) { setSenhaErro("A senha não atende todos os critérios de segurança."); return; }
              if (novaSenha !== confirmarSenha) { setSenhaErro("As senhas não coincidem."); return; }
              setSenhaErro("");
              setUsuarios((prev) => prev.map((u) =>
                u.cpf === pendingUser.cpf
                  ? { ...u, senha: novaSenha, pendingSenha: false, tokenSenha: undefined }
                  : u
              ));
              const atualizado = { ...pendingUser, senha: novaSenha, pendingSenha: false };
              setPendingUser(atualizado);
              generateToken(atualizado);
              setStage("token");
              showToast("Senha definida com sucesso!");
            }

            return (
              <form onSubmit={submitDefinirSenha}>
                <button type="button" onClick={() => setStage("credenciais")} style={{ background: "none", border: "none", color: COLORS.neutral, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", marginBottom: 12, fontSize: 13, padding: 0 }}>
                  <ArrowLeft size={14} /> Voltar
                </button>
                <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, marginTop: 0, color: COLORS.primaryDark }}>Primeiro acesso</h2>
                <p style={{ fontSize: 13, color: COLORS.neutral, margin: "-6px 0 16px" }}>
                  Olá, <strong>{pendingUser?.nome?.split(" ")[0]}</strong>! Sua conta foi criada pelo administrador. Defina uma senha segura para começar.
                </p>
                <Field label="Nova senha" required>
                  <Input type="password" value={novaSenha} onChange={(e) => { setNovaSenha(e.target.value); setSenhaErro(""); }} placeholder="••••••••" />
                </Field>
                {novaSenha.length > 0 && (
                  <div style={{ marginTop: -8, marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                      {[1,2,3,4,5].map((i) => (
                        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= forca ? corForca : COLORS.border, transition: "background .2s" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: corForca, fontWeight: 600, marginBottom: 8 }}>{labelForca}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                      {[
                        ["min8", "Mínimo 8 caracteres"],
                        ["upper", "Letra maiúscula"],
                        ["lower", "Letra minúscula"],
                        ["digit", "Número"],
                        ["special", "Caractere especial"],
                      ].map(([k, label]) => (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: criterios[k] ? COLORS.success : COLORS.neutral }}>
                          {criterios[k] ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Field label="Confirmar senha" required>
                  <Input type="password" value={confirmarSenha} onChange={(e) => { setConfirmarSenha(e.target.value); setSenhaErro(""); }} placeholder="••••••••" />
                </Field>
                {senhaErro && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{senhaErro}</div>}
                <Btn type="submit" style={{ width: "100%", justifyContent: "center" }} disabled={!aprovado}>Definir senha e continuar</Btn>
              </form>
            );
          })() : stage === "credenciais" ? (
            <form onSubmit={submitCredenciais}>
              <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, marginTop: 0, color: COLORS.primaryDark }}>Entrar</h2>
              <Field label="CPF" required>
                <Input placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} required />
              </Field>
              <Field label="Senha" required>
                <Input type="password" placeholder="••••" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              </Field>
              {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{erro}</div>}
              <Btn type="submit" style={{ width: "100%", justifyContent: "center" }}>Entrar</Btn>
              <div style={{ marginTop: 18, padding: 12, background: COLORS.bgAlt, borderRadius: 10, fontSize: 12, color: COLORS.neutral, lineHeight: 1.5 }}>
                <strong style={{ color: COLORS.ink, display: "block", marginBottom: 6 }}>Contas de exemplo (clique para preencher)</strong>
                <button type="button" onClick={() => { setCpf("111.111.111-11"); setSenha("1234"); setErro(""); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: COLORS.primary, cursor: "pointer", padding: "4px 0", fontSize: 12, fontFamily: "Inter, sans-serif" }}>
                  Leitor — 111.111.111-11 / 1234
                </button>
                <button type="button" onClick={() => { setCpf("222.222.222-22"); setSenha("1234"); setErro(""); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: COLORS.primary, cursor: "pointer", padding: "4px 0", fontSize: 12, fontFamily: "Inter, sans-serif" }}>
                  Administrador — 222.222.222-22 / 1234
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm("Isso vai apagar todos os dados salvos neste protótipo (livros, empréstimos, usuários, etc.) e restaurar os dados de demonstração originais. Continuar?")) return;
                  const keys = ["usuarios", "titulos", "exemplares", "emprestimos", "solicitacoes", "listaEspera", "leituras", "anotacoes", "notifLog", "configNotif", "renovacoes", "posts", "grupos", "sugestoes", "auth"];
                  for (const k of keys) { try { await deleteKey(k); } catch {} }
                  await deleteKeysByPrefix("desejos:");
                  window.location.reload();
                }}
                style={{ display: "block", width: "100%", textAlign: "center", background: "none", border: "none", color: COLORS.neutral, cursor: "pointer", padding: "10px 0 0", fontSize: 12, fontFamily: "Inter, sans-serif", textDecoration: "underline" }}
              >
                Resetar dados de demonstração
              </button>
            </form>
          ) : (
            <form onSubmit={submitToken}>
              <button type="button" onClick={() => setStage("credenciais")} style={{ background: "none", border: "none", color: COLORS.neutral, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", marginBottom: 12, fontSize: 13, padding: 0 }}>
                <ArrowLeft size={14} /> Voltar
              </button>
              <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, marginTop: 0, color: COLORS.primaryDark }}>Verificação em duas etapas</h2>
              <p style={{ fontSize: 13, color: COLORS.neutral, marginTop: -6 }}>
                Enviamos um código de 6 dígitos por WhatsApp/SMS (simulado) para {pendingUser?.telefone}.
              </p>
              <div style={{
                background: COLORS.accentLight, border: `1px dashed ${COLORS.accent}`, borderRadius: 10,
                padding: "10px 14px", marginBottom: 16, fontSize: 13, color: COLORS.primaryDark,
              }}>
                <strong>Simulação:</strong> seu código é <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16 }}>{token}</span>
              </div>
              <Field label="Código recebido" required>
                <Input
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  style={{ letterSpacing: 4, fontSize: 18, textAlign: "center" }}
                />
              </Field>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: secondsLeft <= 10 ? COLORS.danger : COLORS.neutral, marginBottom: 14 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> Expira em {secondsLeft}s</span>
                <button type="button" onClick={resend} style={{ background: "none", border: "none", color: COLORS.primary, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Reenviar código</button>
              </div>
              {tokenErro && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{tokenErro}</div>}
              <Btn type="submit" style={{ width: "100%", justifyContent: "center" }} disabled={secondsLeft <= 0}>Confirmar e entrar</Btn>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   SCREEN: PAINEL
   ========================================================================= */
function PainelScreen({ ctx, setRoute }) {
  const { titulos, exemplares, emprestimos, usuarios, renovacoes, leituras } = ctx;
  const isAdmin = ctx.auth.perfil === "administrador";
  const today = todayISO();

  // admin — atenção
  const atrasadosList = emprestimos
    .filter((e) => e.status === "Atrasado")
    .map((e) => ({ ...e, livro: getTituloFromEmprestimo(e, exemplares, titulos), dias: diffDays(e.dataDevolucao, today) }))
    .sort((a, b) => b.dias - a.dias);
  const renovPendentes = (renovacoes || []).filter((r) => r.status === "Solicitada");
  const semAcaoPendente = atrasadosList.length === 0 && renovPendentes.length === 0;

  // admin — visão geral
  const total = titulos.length;
  const ativos = emprestimos.filter((e) => e.status === "Ativo" || e.status === "Atrasado").length;
  const emDiaPct = ativos === 0 ? 100 : Math.round(((ativos - atrasadosList.length) / ativos) * 100);
  const novosUltimos7 = emprestimos.filter((e) => e.dataEmprestimo >= addDays(today, -7)).length;

  // admin — métricas e rankings
  const devolvidos = emprestimos.filter((e) => e.status === "Devolvido" && e.dataDevolucaoEfetiva);
  const duracaoMedia = devolvidos.length === 0 ? 0
    : Math.round(devolvidos.reduce((acc, e) => acc + diffDays(e.dataEmprestimo, e.dataDevolucaoEfetiva), 0) / devolvidos.length);
  const noPrazoCount = devolvidos.filter((e) => e.dataDevolucaoEfetiva <= e.dataDevolucao).length;
  const taxaNoPrazo = devolvidos.length === 0 ? 100 : Math.round((noPrazoCount / devolvidos.length) * 100);
  const totalUsuarios = usuarios.length;
  const totalLeitores = usuarios.filter((u) => u.perfil === "leitor").length;
  const rankingLivros = Object.entries(
    emprestimos.reduce((acc, e) => {
      const ex = exemplares.find((x) => x.id === e.exemplarId);
      if (ex) acc[ex.tituloId] = (acc[ex.tituloId] || 0) + 1;
      return acc;
    }, {})
  ).map(([tituloId, count]) => ({ livro: titulos.find((t) => t.id === tituloId), count }))
    .sort((a, b) => b.count - a.count).slice(0, 10);
  const rankingLeitores = Object.entries(
    emprestimos.reduce((acc, e) => { acc[e.locatario] = (acc[e.locatario] || 0) + 1; return acc; }, {})
  ).map(([nome, count]) => ({ nome, count }))
    .sort((a, b) => b.count - a.count).slice(0, 10);

  // leitor — meus empréstimos
  const primeiroNome = ctx.auth.nome.split(" ")[0].toLowerCase();
  const meusEmprestimos = emprestimos
    .filter((e) => {
      if (e.status === "Devolvido") return false;
      if (e.locatarioCpf) return e.locatarioCpf === ctx.auth.cpf;
      return e.locatario.toLowerCase().includes(primeiroNome);
    })
    .map((e) => ({ ...e, livro: getTituloFromEmprestimo(e, exemplares, titulos), dias: diffDays(today, e.dataDevolucao) }))
    .sort((a, b) => a.dias - b.dias);
  const proximo = meusEmprestimos[0];
  const minhasRenovPendentes = (renovacoes || []).filter(
    (r) => r.status === "Solicitada" && r.locatario.toLowerCase().includes(primeiroNome)
  );
  const emLeitura = (leituras || []).find((l) => l.progresso > 0 && l.progresso < 100);
  const livroEmLeitura = emLeitura ? titulos.find((t) => t.id === emLeitura.livroId) : null;

  // render admin
  if (isAdmin) return (
    <div>
      <Eyebrow text="Acervo Vivo" />
      <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: 26, margin: "0 0 22px", color: COLORS.ink, letterSpacing: "-0.01em" }}>
        {semAcaoPendente ? "Tudo em ordem por aqui" : "O que precisa da sua atenção"}
      </h1>

      {semAcaoPendente ? (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "20px 18px", display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <CheckCircle2 size={20} color={COLORS.success} />
          <div style={{ fontSize: 13, color: COLORS.ink }}>Nenhum empréstimo atrasado e nenhuma renovação pendente de análise.</div>
        </div>
      ) : (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 28 }}>
          {atrasadosList.map((e, i) => (
            <div key={e.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
              padding: "13px 16px", borderLeft: `2px solid ${COLORS.danger}`,
              borderBottom: (i < atrasadosList.length - 1 || renovPendentes.length > 0) ? `1px solid ${COLORS.border}` : "none",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: COLORS.ink, fontWeight: 500 }}>{e.locatario}</div>
                <div style={{ fontSize: 12, color: COLORS.neutral, marginTop: 1 }}>{e.livro?.titulo} · atrasado há {e.dias} {e.dias === 1 ? "dia" : "dias"}</div>
              </div>
              <Btn variant="ghost" style={{ flexShrink: 0, padding: "6px 12px", fontSize: 12 }} onClick={() => setRoute("emprestimos")}>Ver</Btn>
            </div>
          ))}
          {renovPendentes.map((r, i) => {
            const empRenov = emprestimos.find((e) => e.id === r.emprestimoId);
            const tituloRenov = empRenov ? getTituloFromEmprestimo(empRenov, exemplares, titulos) : null;
            return (
              <div key={r.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                padding: "13px 16px", borderLeft: `2px solid ${COLORS.neutralLight}`,
                borderBottom: i < renovPendentes.length - 1 ? `1px solid ${COLORS.border}` : "none",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: COLORS.ink, fontWeight: 500 }}>{r.locatario}</div>
                  <div style={{ fontSize: 12, color: COLORS.neutral, marginTop: 1 }}>pediu renovação de "{tituloRenov?.titulo}"</div>
                </div>
                <Btn variant="ghost" style={{ flexShrink: 0, padding: "6px 12px", fontSize: 12 }} onClick={() => setRoute("renovacoes")}>Avaliar</Btn>
              </div>
            );
          })}
        </div>
      )}

      <Eyebrow text="Visão geral do acervo" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 1, background: COLORS.border, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginTop: 4, marginBottom: 28 }}>
        <div style={{ background: COLORS.bg, padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 10, color: COLORS.neutral, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Acervo</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: COLORS.ink }}>{total}</div>
        </div>
        <div style={{ background: COLORS.bg, padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 10, color: COLORS.neutral, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Empréstimos sem atraso</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: emDiaPct === 100 ? COLORS.success : COLORS.ink }}>{emDiaPct}%</div>
        </div>
        <div style={{ background: COLORS.bg, padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 10, color: COLORS.neutral, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Últimos 7 dias</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: COLORS.ink }}>+{novosUltimos7}</div>
        </div>
      </div>

      <Eyebrow text="Empréstimos e leitores" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 1, background: COLORS.border, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginTop: 4, marginBottom: 22 }}>
        <div style={{ background: COLORS.bg, padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 10, color: COLORS.neutral, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Empréstimos no período</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: COLORS.ink }}>{emprestimos.length}</div>
        </div>
        <div style={{ background: COLORS.bg, padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 10, color: COLORS.neutral, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Duração média</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: COLORS.ink }}>{duracaoMedia}d</div>
        </div>
        <div style={{ background: COLORS.bg, padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 10, color: COLORS.neutral, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Devolvido no prazo</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: taxaNoPrazo >= 80 ? COLORS.success : taxaNoPrazo >= 50 ? COLORS.ink : COLORS.danger }}>{taxaNoPrazo}%</div>
        </div>
        <div style={{ background: COLORS.bg, padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 10, color: COLORS.neutral, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Usuários cadastrados</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: COLORS.ink }}>{totalUsuarios}</div>
          <div style={{ fontSize: 11, color: COLORS.neutral, marginTop: 2 }}>{totalLeitores} leitores</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
        <RankingCard title="Livros mais emprestados" items={rankingLivros.map((r) => ({ label: r.livro?.titulo || "—", count: r.count }))} unit={(n) => n === 1 ? "empréstimo" : "empréstimos"} />
        <RankingCard title="Leitores que mais pegaram livros" items={rankingLeitores.map((r) => ({ label: r.nome, count: r.count }))} unit={(n) => n === 1 ? "empréstimo" : "empréstimos"} />
      </div>
    </div>
  );

  // render leitor
  return (
    <div>
      <Eyebrow text="Acervo Vivo" />
      {proximo ? (
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: 24, margin: "0 0 4px", color: COLORS.ink, letterSpacing: "-0.01em" }}>
            {proximo.dias < 0 ? <>Atrasado há {Math.abs(proximo.dias)} {Math.abs(proximo.dias) === 1 ? "dia" : "dias"}</> : proximo.dias === 0 ? "Devolução é hoje" : <>Devolver em {proximo.dias} {proximo.dias === 1 ? "dia" : "dias"}</>}
          </h1>
          <p style={{ fontSize: 14, color: COLORS.neutral, margin: 0 }}>"{proximo.livro?.titulo}" · até {diaSemanaCurto(proximo.dataDevolucao)}, {fmtDate(proximo.dataDevolucao)}</p>
        </div>
      ) : (
        <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: 24, margin: "0 0 22px", color: COLORS.ink, letterSpacing: "-0.01em" }}>Olá, {ctx.auth.nome.split(" ")[0]}</h1>
      )}

      {meusEmprestimos.length === 0 ? (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "20px 18px", marginBottom: 18 }}>
          <div style={{ fontSize: 14, color: COLORS.ink, fontWeight: 500, marginBottom: 4 }}>Você não tem nenhum livro emprestado.</div>
          <div style={{ fontSize: 13, color: COLORS.neutral, marginBottom: 12 }}>Explore o acervo e peça seu próximo livro.</div>
          <Btn variant="ghost" onClick={() => setRoute("livros")}>Ver catálogo</Btn>
        </div>
      ) : (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
          {meusEmprestimos.map((e, i) => (
            <div key={e.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
              padding: "13px 16px", borderLeft: `2px solid ${e.dias < 0 ? COLORS.danger : COLORS.neutralLight}`,
              borderBottom: i < meusEmprestimos.length - 1 ? `1px solid ${COLORS.border}` : "none",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: COLORS.ink, fontWeight: 500 }}>{e.livro?.titulo}</div>
                <div style={{ fontSize: 12, color: COLORS.neutral, marginTop: 1 }}>
                  {e.dias < 0 ? `atrasado há ${Math.abs(e.dias)} dias` : e.dias === 0 ? "devolver hoje" : `devolver em ${e.dias} dias`}
                </div>
              </div>
              <Btn variant="ghost" style={{ flexShrink: 0, padding: "6px 12px", fontSize: 12 }} onClick={() => setRoute("emprestimos")}>Ver</Btn>
            </div>
          ))}
        </div>
      )}

      {minhasRenovPendentes.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.neutral, marginBottom: 18 }}>
          <Clock size={14} />
          {minhasRenovPendentes.length === 1 ? "1 renovação aguardando resposta do administrador." : `${minhasRenovPendentes.length} renovações aguardando resposta.`}
        </div>
      )}

      {livroEmLeitura && (
        <div>
          <Eyebrow text="Continue lendo" />
          <button onClick={() => setRoute("leitura")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "13px 16px", background: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", marginTop: 4 }}>
            <span style={{ fontSize: 13, color: COLORS.ink, fontWeight: 500 }}>{livroEmLeitura.titulo}</span>
            <span style={{ fontSize: 12, color: COLORS.neutral }}>{emLeitura.progresso}% concluído</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Eyebrow({ text }) {
  return (
    <div style={{ fontSize: 10, color: COLORS.neutral, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
      {text}
    </div>
  );
}

function RankingCard({ title, items, unit }) {
  const max = items.length ? items[0].count : 1;
  return (
    <div>
      <div style={{ fontSize: 12, color: COLORS.ink, fontWeight: 500, marginBottom: 10 }}>{title}</div>
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
        {items.map((it, i) => (
          <div key={it.label + i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
            borderBottom: i < items.length - 1 ? `1px solid ${COLORS.border}` : "none",
          }}>
            <div style={{ fontSize: 11, color: COLORS.neutralLight, fontWeight: 600, width: 16, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: COLORS.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</div>
              <div style={{ height: 3, background: COLORS.bgAlt, borderRadius: 999, marginTop: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.max(8, (it.count / max) * 100)}%`, height: "100%", background: COLORS.accent, borderRadius: 999 }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: COLORS.neutral, flexShrink: 0, minWidth: 14, textAlign: "right" }}>{it.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageTitle({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 30, margin: 0, color: COLORS.primaryDark }}>{title}</h1>
        {subtitle && <p style={{ color: COLORS.neutral, margin: "4px 0 0", fontSize: 14 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* =========================================================================
   SCREEN: LIVROS (Título/Exemplar model)
   ========================================================================= */
const ESTADOS_CONSERVACAO = ["Ótimo", "Bom", "Regular", "Ruim"];

function LivrosScreen({ ctx }) {
  const { titulos, setTitulos, exemplares, setExemplares, emprestimos, showToast, auth, routeParams } = ctx;
  const isAdmin = auth.perfil === "administrador";
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [availFilter, setAvailFilter] = useState("Todos");
  const [viewMode, setViewMode] = useState("grade");
  const [formTitulo, setFormTitulo] = useState(null); // null=fechado, {}=novo, {id,...}=editar
  const [formExemplar, setFormExemplar] = useState(null); // {tituloId} ou {id,...}
  const [detailId, setDetailId] = useState(null);
  const [toDelete, setToDelete] = useState(null); // { tipo: "titulo"|"exemplar", item }

  useEffect(() => {
    if (routeParams?.livroId) setDetailId(routeParams.livroId);
  }, [routeParams?.livroId]);

  useEffect(() => {
    loadKey("catalogo:visualizacao", "grade").then(setViewMode);
  }, []);

  function setView(mode) { setViewMode(mode); saveKey("catalogo:visualizacao", mode); }
  function norm(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  const allCats = [...new Set(titulos.flatMap((t) => t.generos))].sort();

  const filtered = titulos.filter((t) => {
    const q = norm(query);
    if (q && !norm(t.titulo).includes(q) && !norm(t.autor).includes(q) && !t.isbn.includes(q)) return false;
    if (catFilter && !t.generos.includes(catFilter)) return false;
    if (availFilter !== "Todos") {
      const st = getStatusTitulo(t.id, exemplares);
      if (st !== availFilter) return false;
    }
    return true;
  });

  const hasActiveFilter = !!(query || catFilter || availFilter !== "Todos");
  function clearFilters() { setQuery(""); setCatFilter(""); setAvailFilter("Todos"); }

  function saveTitulo(data) {
    if (formTitulo?.id) {
      setTitulos((prev) => prev.map((t) => t.id === formTitulo.id ? { ...t, ...data } : t));
      showToast("Título atualizado.");
    } else {
      const novoId = uid("L");
      setTitulos((prev) => [...prev, { ...data, id: novoId, nota: 0, comentario: "" }]);
      showToast("Título cadastrado.");
    }
    setFormTitulo(null);
  }

  function saveExemplar(data) {
    if (formExemplar?.id) {
      setExemplares((prev) => prev.map((ex) => ex.id === formExemplar.id ? { ...ex, ...data } : ex));
      showToast("Exemplar atualizado.");
    } else {
      setExemplares((prev) => [...prev, { ...data, id: uid("EX"), status: "Disponível", emprestimoAtualId: null, motivoIndisponivel: null, historico: [] }]);
      showToast("Exemplar cadastrado.");
    }
    setFormExemplar(null);
  }

  function excluirTitulo(t) {
    const exsDoTitulo = exemplares.filter((ex) => ex.tituloId === t.id);
    const temAtivo = exsDoTitulo.some((ex) => emprestimos.some((e) => e.exemplarId === ex.id && (e.status === "Ativo" || e.status === "Atrasado")));
    if (temAtivo) { showToast("Não é possível excluir: há empréstimo ativo."); setToDelete(null); return; }
    setExemplares((prev) => prev.filter((ex) => ex.tituloId !== t.id));
    setTitulos((prev) => prev.filter((x) => x.id !== t.id));
    setToDelete(null);
    showToast("Título e exemplares excluídos.");
  }

  function excluirExemplar(ex) {
    const temAtivo = emprestimos.some((e) => e.exemplarId === ex.id && (e.status === "Ativo" || e.status === "Atrasado"));
    if (temAtivo) { showToast("Não é possível excluir: há empréstimo ativo."); setToDelete(null); return; }
    setExemplares((prev) => prev.filter((x) => x.id !== ex.id));
    setToDelete(null);
    showToast("Exemplar excluído.");
  }

  const detailTitulo = detailId ? titulos.find((t) => t.id === detailId) : null;
  if (detailTitulo) {
    return (
      <TituloDetalhe
        titulo={detailTitulo}
        ctx={ctx}
        onBack={() => setDetailId(null)}
        onEditTitulo={() => { setDetailId(null); setFormTitulo(detailTitulo); }}
        onAddExemplar={() => setFormExemplar({ tituloId: detailTitulo.id })}
        onEditExemplar={(ex) => setFormExemplar(ex)}
        onDeleteExemplar={(ex) => setToDelete({ tipo: "exemplar", item: ex })}
      />
    );
  }

  return (
    <div>
      <PageTitle
        title="Catálogo"
        subtitle={`${titulos.length} título(s) · ${exemplares.length} exemplar(es)`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" icon={Download} onClick={() => showToast("Exportação simulada do acervo.")}>Exportar</Btn>
            {isAdmin && <Btn icon={Plus} onClick={() => setFormTitulo({})}>Novo título</Btn>}
          </div>
        }
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={query} onChange={setQuery} placeholder="Buscar por título, autor ou ISBN..." />
        </div>
        <div style={{ display: "flex", gap: 2, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 3, background: "#fff", flexShrink: 0 }}>
          {[["grade", LayoutGrid], ["lista", List]].map(([mode, Icon]) => (
            <button key={mode} aria-label={mode} onClick={() => setView(mode)} style={{ padding: "7px 10px", borderRadius: 8, border: "none", background: viewMode === mode ? COLORS.primary : "transparent", color: viewMode === mode ? "#fff" : COLORS.neutral, cursor: "pointer", display: "flex", alignItems: "center", transition: "all .15s" }}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {allCats.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 10, scrollbarWidth: "none" }}>
          <FilterChip label="Todas" active={!catFilter} onClick={() => setCatFilter("")} />
          {allCats.map((cat) => <FilterChip key={cat} label={cat} active={catFilter === cat} onClick={() => setCatFilter(catFilter === cat ? "" : cat)} />)}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["Todos", "Disponível", "Emprestado", "Indisponível"].map((opt) => (
          <FilterChip key={opt} label={opt} active={availFilter === opt} onClick={() => setAvailFilter(opt)} />
        ))}
      </div>

      <div style={{ fontSize: 13, color: COLORS.neutral, marginBottom: 14 }}>
        {filtered.length} {filtered.length === 1 ? "título encontrado" : "títulos encontrados"}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "52px 20px", color: COLORS.neutral }}>
          <BookX size={40} style={{ marginBottom: 12, opacity: 0.45 }} />
          <div style={{ fontSize: 15, marginBottom: 16 }}>Nenhum título corresponde aos filtros.</div>
          {hasActiveFilter && <Btn variant="ghost" onClick={clearFilters}>Limpar filtros</Btn>}
        </div>
      ) : viewMode === "grade" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {filtered.map((t) => (
            <CatalogoCardGrade key={t.id} titulo={t} exemplares={exemplares} onOpen={setDetailId} onEdit={isAdmin ? (tt) => setFormTitulo(tt) : null} onDelete={isAdmin ? (tt) => setToDelete({ tipo: "titulo", item: tt }) : null} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((t) => (
            <CatalogoItemLista key={t.id} titulo={t} exemplares={exemplares} onOpen={setDetailId} onEdit={isAdmin ? (tt) => setFormTitulo(tt) : null} onDelete={isAdmin ? (tt) => setToDelete({ tipo: "titulo", item: tt }) : null} />
          ))}
        </div>
      )}

      {formTitulo !== null && (
        <TituloForm initial={formTitulo?.id ? formTitulo : null} onSave={saveTitulo} onClose={() => setFormTitulo(null)} />
      )}
      {formExemplar !== null && (
        <ExemplarForm initial={formExemplar?.id ? formExemplar : null} tituloId={formExemplar.tituloId || formExemplar.id && formExemplar.tituloId} onSave={saveExemplar} onClose={() => setFormExemplar(null)} />
      )}
      {toDelete?.tipo === "titulo" && (
        <Confirm text={`Excluir o título "${toDelete.item.titulo}" e todos os seus exemplares?`} onConfirm={() => excluirTitulo(toDelete.item)} onCancel={() => setToDelete(null)} />
      )}
      {toDelete?.tipo === "exemplar" && (
        <Confirm text={`Excluir o exemplar ${toDelete.item.tombo}?`} onConfirm={() => excluirExemplar(toDelete.item)} onCancel={() => setToDelete(null)} />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      whiteSpace: "nowrap", border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
      background: active ? COLORS.primary : "#fff", color: active ? "#fff" : COLORS.ink,
      padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: active ? 600 : 500,
      cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all .15s", flexShrink: 0,
    }}>{label}</button>
  );
}

function disponibilidadeBadgeStyle(st) {
  if (st === "Disponível") return { background: COLORS.primary, color: "#fff" };
  if (st === "Indisponível") return { background: COLORS.neutral, color: "#fff" };
  return { background: COLORS.accent, color: "#fff" };
}

function CatalogoCardGrade({ titulo: t, exemplares, onOpen, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const disp = getDisponibilidadeTitulo(t.id, exemplares);
  const st = getStatusTitulo(t.id, exemplares);
  const total = exemplares.filter((ex) => ex.tituloId === t.id).length;
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", transition: "transform .2s ease, box-shadow .2s ease", transform: hovered ? "scale(1.02)" : "scale(1)", boxShadow: hovered ? "0 8px 24px rgba(43,76,63,0.13)" : "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div onClick={() => onOpen(t.id)} style={{ position: "relative", width: "100%", paddingBottom: "140%", background: COLORS.bgAlt, cursor: "pointer", flexShrink: 0 }}>
        {t.foto ? <img src={t.foto} alt={t.titulo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><BookOpen size={32} color={COLORS.neutral} style={{ opacity: 0.35 }} /></div>}
        <div style={{ position: "absolute", top: 8, right: 8, ...disponibilidadeBadgeStyle(st), fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 999 }}>
          {st === "Disponível" ? `${disp}/${total}` : st}
        </div>
      </div>
      <div onClick={() => onOpen(t.id)} style={{ padding: "10px 12px 6px", flex: 1, cursor: "pointer" }}>
        <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 14, fontWeight: 600, color: COLORS.ink, lineHeight: 1.3, marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{t.titulo}</div>
        <div style={{ fontSize: 12, color: COLORS.neutral, marginBottom: 6 }}>{t.autor}</div>
        {t.generos[0] && <span style={{ fontSize: 11, background: COLORS.bgAlt, color: COLORS.neutral, padding: "2px 8px", borderRadius: 999 }}>{t.generos[0]}</span>}
      </div>
      {(onEdit || onDelete) && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, padding: "4px 8px 8px", opacity: hovered ? 1 : 0, transition: "opacity .18s" }}>
          {onEdit && <Btn variant="icon" onClick={(e) => { e.stopPropagation(); onEdit(t); }} title="Editar" style={{ padding: 5, borderRadius: 7 }}><Edit2 size={13} /></Btn>}
          {onDelete && <Btn variant="icon" onClick={(e) => { e.stopPropagation(); onDelete(t); }} title="Excluir" style={{ padding: 5, borderRadius: 7, color: COLORS.danger }}><Trash2 size={13} /></Btn>}
        </div>
      )}
    </div>
  );
}

function CatalogoItemLista({ titulo: t, exemplares, onOpen, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const disp = getDisponibilidadeTitulo(t.id, exemplares);
  const st = getStatusTitulo(t.id, exemplares);
  const total = exemplares.filter((ex) => ex.tituloId === t.id).length;
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 14, alignItems: "center", transition: "transform .15s ease, box-shadow .15s ease", transform: hovered ? "translateY(-1px)" : "none", boxShadow: hovered ? "0 4px 14px rgba(43,76,63,0.09)" : "none" }}>
      <div onClick={() => onOpen(t.id)} style={{ width: 56, height: 80, borderRadius: 6, flexShrink: 0, background: COLORS.bgAlt, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {t.foto ? <img src={t.foto} alt={t.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <BookOpen size={20} color={COLORS.neutral} style={{ opacity: 0.4 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpen(t.id)}>
        <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 16, fontWeight: 600, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titulo}</div>
        <div style={{ fontSize: 13, color: COLORS.neutral, margin: "2px 0 7px" }}>{t.autor}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, fontFamily: "Inter, sans-serif", ...disponibilidadeBadgeStyle(st) }}>
            {st === "Disponível" ? `${disp} disponível${disp !== 1 ? "is" : ""} (${total})` : `${st} (${total})`}
          </span>
          {t.generos[0] && <span style={{ fontSize: 11, background: COLORS.bgAlt, color: COLORS.neutral, padding: "2px 8px", borderRadius: 999 }}>{t.generos[0]}</span>}
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {onEdit && <Btn variant="icon" onClick={() => onEdit(t)} title="Editar"><Edit2 size={14} /></Btn>}
          {onDelete && <Btn variant="icon" onClick={() => onDelete(t)} title="Excluir" style={{ color: COLORS.danger }}><Trash2 size={14} /></Btn>}
        </div>
      )}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative" }}>
      <Search size={16} color={COLORS.neutral} style={{ position: "absolute", left: 12, top: 12 }} />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ paddingLeft: 36 }} />
    </div>
  );
}

function TituloForm({ initial, onSave, onClose }) {
  const [data, setData] = useState(initial || { isbn: "", titulo: "", autor: "", ano: "", edicao: "", editora: "", local: "", paginas: "", generos: [], foto: null });
  const [genText, setGenText] = useState((initial?.generos || []).join(", "));
  const [err, setErr] = useState("");
  function set(k, v) { setData((d) => ({ ...d, [k]: v })); }
  function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => set("foto", reader.result); reader.readAsDataURL(file);
  }
  function submit(e) {
    e.preventDefault();
    if (!data.titulo.trim()) { setErr("O título é obrigatório."); return; }
    onSave({ ...data, generos: genText.split(",").map((g) => g.trim()).filter(Boolean) });
  }
  return (
    <Modal title={initial ? "Editar Título" : "Novo Título"} onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 70, height: 96, borderRadius: 8, background: COLORS.bgAlt, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
            {data.foto ? <img src={data.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={22} color={COLORS.neutral} />}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Capa</label>
            <input type="file" accept="image/*" onChange={handleFile} style={{ fontSize: 12 }} />
          </div>
        </div>
        <Field label="ISBN"><Input value={data.isbn} onChange={(e) => set("isbn", e.target.value)} /></Field>
        <Field label="Título" required><Input value={data.titulo} onChange={(e) => set("titulo", e.target.value)} /></Field>
        <Field label="Autor"><Input value={data.autor} onChange={(e) => set("autor", e.target.value)} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Ano"><Input value={data.ano} onChange={(e) => set("ano", e.target.value)} /></Field>
          <Field label="Edição"><Input value={data.edicao} onChange={(e) => set("edicao", e.target.value)} /></Field>
        </div>
        <Field label="Editora"><Input value={data.editora} onChange={(e) => set("editora", e.target.value)} /></Field>
        <Field label="Local"><Input value={data.local} onChange={(e) => set("local", e.target.value)} /></Field>
        <Field label="Páginas"><Input type="number" value={data.paginas} onChange={(e) => set("paginas", e.target.value)} /></Field>
        <Field label="Gênero / Tag" hint="Separe por vírgula"><Input value={genText} onChange={(e) => setGenText(e.target.value)} placeholder="Ex: Romance, Ficção, Teologia" /></Field>
        {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <Btn type="submit" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>{initial ? "Salvar alterações" : "Cadastrar título"}</Btn>
      </form>
    </Modal>
  );
}

function ExemplarForm({ initial, tituloId, onSave, onClose }) {
  const [tombo, setTombo] = useState(initial?.tombo || "");
  const [estadoConservacao, setEstadoConservacao] = useState(initial?.estadoConservacao || "Bom");
  function mockScan() { setTombo("T-" + String(Math.floor(1000 + Math.random() * 8999))); }
  function submit(e) {
    e.preventDefault();
    onSave({ tituloId: tituloId || initial?.tituloId, tombo: tombo.trim(), estadoConservacao });
  }
  return (
    <Modal title={initial ? "Editar Exemplar" : "Novo Exemplar"} onClose={onClose} width={420}>
      <form onSubmit={submit}>
        <Btn type="button" variant="ghost" icon={Camera} onClick={mockScan} style={{ width: "100%", marginBottom: 16 }}>Escanear Tombo</Btn>
        <Field label="Tombo"><Input value={tombo} onChange={(e) => setTombo(e.target.value)} placeholder="T-0001" /></Field>
        <Field label="Estado de Conservação">
          <Select value={estadoConservacao} onChange={(e) => setEstadoConservacao(e.target.value)}>
            {ESTADOS_CONSERVACAO.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Btn type="submit" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>{initial ? "Salvar" : "Adicionar exemplar"}</Btn>
      </form>
    </Modal>
  );
}

/* Modal para marcar exemplar como indisponível (Part A) */
function IndisponivelModal({ exemplar, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState(exemplar.motivoIndisponivel || "");
  return (
    <Modal title="Marcar como Indisponível" onClose={onClose} width={420}>
      <p style={{ fontSize: 13, color: COLORS.neutral, marginTop: 0 }}>Exemplar <strong>{exemplar.tombo}</strong> ficará indisponível para empréstimos.</p>
      <Field label="Motivo (opcional)"><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Em restauro, aguardando encadernação..." /></Field>
      <Btn onClick={() => onConfirm(motivo)} style={{ width: "100%", justifyContent: "center" }}>Confirmar</Btn>
    </Modal>
  );
}

/* Modal para solicitar empréstimo (leitor — Part B) */
function SolicitacaoModal({ titulo, onConfirm, onClose }) {
  const [dataDesejada, setDataDesejada] = useState("");
  return (
    <Modal title="Solicitar Empréstimo" onClose={onClose} width={420}>
      <p style={{ fontSize: 13, color: COLORS.neutral, marginTop: 0 }}>Você está solicitando o empréstimo de <strong>{titulo.titulo}</strong>. O administrador confirmará e selecionará um exemplar.</p>
      <Field label="Data de devolução desejada (opcional)"><Input type="date" value={dataDesejada} onChange={(e) => setDataDesejada(e.target.value)} min={todayISO()} /></Field>
      <Btn onClick={() => onConfirm(dataDesejada)} style={{ width: "100%", justifyContent: "center" }}>Enviar solicitação</Btn>
    </Modal>
  );
}

function TituloDetalhe({ titulo, ctx, onBack, onEditTitulo, onAddExemplar, onEditExemplar, onDeleteExemplar }) {
  const { setTitulos, exemplares, setExemplares, emprestimos, showToast, setPosts, auth, solicitacoes, setSolicitacoes, listaEspera, setListaEspera } = ctx;
  const isAdmin = auth.perfil === "administrador";
  const [nota, setNota] = useState(titulo.nota);
  const [comentario, setComentario] = useState(titulo.comentario);
  const [compartilhar, setCompartilhar] = useState(false);
  const [indispModal, setIndispModal] = useState(null); // exemplar a marcar
  const [solicitarModal, setSolicitarModal] = useState(false);

  const exsDoTitulo = exemplares.filter((ex) => ex.tituloId === titulo.id);
  const disp = getDisponibilidadeTitulo(titulo.id, exemplares);
  const minhasolicPendente = solicitacoes.find((s) => s.tituloId === titulo.id && s.solicitanteCpf === auth.cpf && s.status === "pendente");
  const minhaFilaEntry = listaEspera.find((le) => le.tituloId === titulo.id && le.usuarioCpf === auth.cpf);
  const filaDoTitulo = listaEspera.filter((le) => le.tituloId === titulo.id).sort((a, b) => a.dataEntrada.localeCompare(b.dataEntrada));

  const historicoEmprestimos = emprestimos.filter((e) => exsDoTitulo.some((ex) => ex.id === e.exemplarId)).sort((a, b) => b.dataEmprestimo.localeCompare(a.dataEmprestimo));

  function salvarAvaliacao() {
    setTitulos((prev) => prev.map((t) => t.id === titulo.id ? { ...t, nota, comentario } : t));
    if (compartilhar) setPosts((prev) => [{ id: uid("P"), autor: auth.nome, texto: `Avaliei "${titulo.titulo}" com ${nota} estrela(s): ${comentario || "(sem comentário)"}`, data: new Date().toISOString(), likes: [], comentarios: [] }, ...prev]);
    showToast("Avaliação salva." + (compartilhar ? " Compartilhada na comunidade." : ""));
  }

  function marcarIndisponivel(ex, motivo) {
    setExemplares((prev) => prev.map((x) => x.id === ex.id ? { ...x, status: "Indisponível", motivoIndisponivel: motivo || null } : x));
    setIndispModal(null);
    showToast("Exemplar marcado como indisponível.");
  }

  function disponibilizar(ex) {
    setExemplares((prev) => prev.map((x) => x.id === ex.id ? { ...x, status: "Disponível", motivoIndisponivel: null } : x));
    showToast("Exemplar disponibilizado.");
  }

  function solicitarEmprestimo(dataDesejada) {
    setSolicitacoes((prev) => [...prev, { id: uid("S"), tituloId: titulo.id, solicitanteCpf: auth.cpf, solicitanteNome: auth.nome, dataSolicitacao: new Date().toISOString(), dataDesejada: dataDesejada || null, status: "pendente" }]);
    setSolicitarModal(false);
    showToast("Solicitação enviada. Aguarde confirmação do administrador.");
  }

  function entrarFila() {
    if (minhaFilaEntry) { showToast("Você já está na lista de espera."); return; }
    setListaEspera((prev) => [...prev, { id: uid("LE"), tituloId: titulo.id, usuarioCpf: auth.cpf, usuarioNome: auth.nome, dataEntrada: new Date().toISOString() }]);
    showToast("Você entrou na lista de espera.");
  }

  function sairFila() {
    setListaEspera((prev) => prev.filter((le) => !(le.tituloId === titulo.id && le.usuarioCpf === auth.cpf)));
    showToast("Você saiu da lista de espera.");
  }

  const exStatusColor = (st) => st === "Disponível" ? COLORS.success : st === "Indisponível" ? COLORS.neutral : COLORS.accent;

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, color: COLORS.neutral, cursor: "pointer", marginBottom: 14, fontSize: 13, padding: 0 }}>
        <ArrowLeft size={15} /> Voltar para Livros
      </button>

      <div style={{ display: "flex", gap: 18, marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ width: 110, height: 150, borderRadius: 10, background: COLORS.bgAlt, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {titulo.foto ? <img src={titulo.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={28} color={COLORS.neutral} />}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 26, margin: 0, color: COLORS.primaryDark }}>{titulo.titulo}</h1>
          <p style={{ color: COLORS.neutral, margin: "4px 0 10px" }}>{titulo.autor} · {titulo.ano} · {titulo.editora}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <Badge tone={disp > 0 ? "success" : "accent"}>{disp > 0 ? `${disp} disponível${disp !== 1 ? "is" : ""}` : "Sem disponível"}</Badge>
            {titulo.generos.map((g) => <Badge key={g} tone="neutral">{g}</Badge>)}
          </div>
          <p style={{ fontSize: 13, color: COLORS.neutral, margin: 0 }}>ISBN {titulo.isbn} · {titulo.paginas} págs · {titulo.local}</p>
          {isAdmin && <Btn variant="ghost" icon={Edit2} onClick={onEditTitulo} style={{ marginTop: 12 }}>Editar título</Btn>}

          {/* Part B: Reader loan request or Part D: waitlist */}
          {!isAdmin && (
            <div style={{ marginTop: 14 }}>
              {disp > 0 ? (
                minhasolicPendente ? (
                  <div style={{ fontSize: 13, color: COLORS.warn, display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} /> Solicitação enviada — aguardando confirmação</div>
                ) : (
                  <Btn icon={BookOpen} onClick={() => setSolicitarModal(true)}>Solicitar empréstimo</Btn>
                )
              ) : (
                minhaFilaEntry ? (
                  <div>
                    <div style={{ fontSize: 13, color: COLORS.neutral, marginBottom: 8 }}>Você está na fila (posição {filaDoTitulo.findIndex((le) => le.usuarioCpf === auth.cpf) + 1})</div>
                    <Btn variant="ghost" onClick={sairFila}>Sair da fila</Btn>
                  </div>
                ) : (
                  <Btn variant="ghost" icon={Clock} onClick={entrarFila}>Entrar na lista de espera</Btn>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Exemplares — Part A */}
      <Section title={`Exemplares (${exsDoTitulo.length})`}>
        {exsDoTitulo.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.neutral }}>Nenhum exemplar cadastrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {exsDoTitulo.map((ex) => (
              <div key={ex.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ex.tombo || "Sem tombo"}</div>
                  <div style={{ fontSize: 12, color: COLORS.neutral }}>Conservação: {ex.estadoConservacao}</div>
                  {ex.motivoIndisponivel && <div style={{ fontSize: 11, color: COLORS.neutral, fontStyle: "italic" }}>{ex.motivoIndisponivel}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: exStatusColor(ex.status), background: ex.status === "Disponível" ? COLORS.successBg : ex.status === "Indisponível" ? COLORS.bgAlt : COLORS.accentLight }}>{ex.status}</span>
                  {isAdmin && (
                    <>
                      {ex.status === "Disponível" && <Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setIndispModal(ex)}>Indisponibilizar</Btn>}
                      {ex.status === "Indisponível" && <Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => disponibilizar(ex)}>Disponibilizar</Btn>}
                      <Btn variant="icon" onClick={() => onEditExemplar(ex)} title="Editar"><Edit2 size={13} /></Btn>
                      <Btn variant="icon" onClick={() => onDeleteExemplar(ex)} title="Excluir" style={{ color: COLORS.danger }}><Trash2 size={13} /></Btn>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {isAdmin && <Btn variant="ghost" icon={Plus} onClick={onAddExemplar} style={{ marginTop: 12 }}>Adicionar exemplar</Btn>}
      </Section>

      {/* Part D: Lista de espera (admin view) */}
      {isAdmin && filaDoTitulo.length > 0 && (
        <Section title={`Lista de espera (${filaDoTitulo.length})`}>
          <div style={{ display: "grid", gap: 6 }}>
            {filaDoTitulo.map((le, i) => (
              <div key={le.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontSize: 11, color: COLORS.neutral, width: 20, flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ flex: 1 }}>{le.usuarioNome}</span>
                <span style={{ fontSize: 11, color: COLORS.neutral }}>{fmtDate(le.dataEntrada.slice(0, 10))}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Avaliação e comentário">
        <Stars value={nota} onChange={setNota} size={24} />
        <Textarea style={{ marginTop: 10 }} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escreva sua opinião sobre este livro..." />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.neutral, marginTop: 8 }}>
          <input type="checkbox" checked={compartilhar} onChange={(e) => setCompartilhar(e.target.checked)} />
          Compartilhar esta avaliação no feed da Comunidade
        </label>
        <Btn onClick={salvarAvaliacao} style={{ marginTop: 10 }}>Salvar avaliação</Btn>
      </Section>

      <Section title="Histórico de empréstimos deste título">
        {historicoEmprestimos.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.neutral }}>Nenhum empréstimo registrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {historicoEmprestimos.map((e) => {
              const ex = exemplares.find((x) => x.id === e.exemplarId);
              return (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
                  <div>
                    <strong>{e.locatario}</strong> · {ex?.tombo} · {fmtDate(e.dataEmprestimo)} → {fmtDate(e.dataDevolucao)}
                  </div>
                  <StatusBadge status={e.status} />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {indispModal && <IndisponivelModal exemplar={indispModal} onConfirm={(motivo) => marcarIndisponivel(indispModal, motivo)} onClose={() => setIndispModal(null)} />}
      {solicitarModal && <SolicitacaoModal titulo={titulo} onConfirm={solicitarEmprestimo} onClose={() => setSolicitarModal(false)} />}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 19, color: COLORS.primaryDark, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = status === "Devolvido" ? "success" : status === "Atrasado" ? "danger" : "warn";
  return <Badge tone={tone}>{status}</Badge>;
}

/* =========================================================================
   SCREEN: EMPRÉSTIMOS
   ========================================================================= */
function EmprestimosScreen({ ctx }) {
  const { emprestimos, setEmprestimos, titulos, exemplares, setExemplares, solicitacoes, setSolicitacoes, sendNotif, showToast, setRenovacoes, auth, configNotif } = ctx;
  const isAdmin = auth.perfil === "administrador";
  const [tab, setTab] = useState("ativos");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [renovarTarget, setRenovarTarget] = useState(null);
  const [toReturn, setToReturn] = useState(null);
  const [confirmarSol, setConfirmarSol] = useState(null); // solicitacao to confirm
  const [recusarSol, setRecusarSol] = useState(null); // solicitacao to recuse

  const pendentesCount = solicitacoes.filter((s) => s.status === "pendente").length;

  const filtered = emprestimos.filter((e) => {
    const q = query.toLowerCase();
    const titulo = getTituloFromEmprestimo(e, exemplares, titulos);
    const matchesQuery = !q || e.locatario.toLowerCase().includes(q) || (titulo && titulo.titulo.toLowerCase().includes(q));
    if (tab === "ativos") return matchesQuery && (e.status === "Ativo" || e.status === "Atrasado");
    return matchesQuery;
  });

  function registrar(data) {
    const titulo = titulos.find((t) => t.id === data.tituloId);
    const exemplar = exemplares.find((ex) => ex.id === data.exemplarId);
    const novo = { id: uid("E"), exemplarId: data.exemplarId, locatario: data.locatario, locatarioCpf: data.locatarioCpf || null, dataEmprestimo: todayISO(), dataDevolucao: data.dataDevolucao, observacoes: data.observacoes || "", status: "Ativo", renovacao: null };
    setEmprestimos((prev) => [novo, ...prev]);
    setExemplares((prev) => prev.map((ex) => ex.id === data.exemplarId ? { ...ex, status: "Emprestado", emprestimoAtualId: novo.id } : ex));
    const cfg = configNotif.find((c) => c.id === "reserva");
    const texto = (cfg?.texto || "")
      .replace("{nome_locatario}", data.locatario)
      .replace("{nome_livro}", titulo?.titulo || "")
      .replace("{data_devolucao}", fmtDate(data.dataDevolucao));
    sendNotif("Reserva confirmada", data.locatario, texto);
    showToast("Empréstimo registrado e notificação enviada (simulada).");
    setFormOpen(false);
  }

  function devolver(e) {
    const agora = new Date().toISOString();
    setEmprestimos((prev) => prev.map((x) => x.id === e.id ? { ...x, status: "Devolvido", dataDevolvido: agora, devolvidoPor: auth.nome, dataDevolucaoEfetiva: todayISO() } : x));
    setExemplares((prev) => prev.map((ex) => ex.id === e.exemplarId ? { ...ex, status: "Disponível", emprestimoAtualId: null } : ex));
    setToReturn(null);
    showToast("Devolução registrada.");
  }

  function solicitarRenovacao(emprestimo, justificativa, novaDataSugerida) {
    setRenovacoes((prev) => [{ id: uid("R"), emprestimoId: emprestimo.id, locatario: emprestimo.locatario, exemplarId: emprestimo.exemplarId, justificativa, status: "Solicitada", dataSolicitacao: new Date().toISOString(), novaDataSugerida }, ...prev]);
    setEmprestimos((prev) => prev.map((e) => e.id === emprestimo.id ? { ...e, renovacao: "Solicitada" } : e));
    setRenovarTarget(null);
    showToast("Solicitação de renovação enviada ao administrador.");
  }

  function confirmarSolicitacao(sol, exemplarId, dataEmprestimo, dataDevolucao) {
    const titulo = titulos.find((t) => t.id === sol.tituloId);
    const novo = { id: uid("E"), exemplarId, locatario: sol.solicitanteNome, locatarioCpf: sol.solicitanteCpf, dataEmprestimo, dataDevolucao, observacoes: "", status: "Ativo", renovacao: null };
    setEmprestimos((prev) => [novo, ...prev]);
    setExemplares((prev) => prev.map((ex) => ex.id === exemplarId ? { ...ex, status: "Emprestado", emprestimoAtualId: novo.id } : ex));
    setSolicitacoes((prev) => prev.map((s) => s.id === sol.id ? { ...s, status: "confirmada", emprestimoId: novo.id } : s));
    sendNotif("Empréstimo confirmado", sol.solicitanteNome, `Seu empréstimo de "${titulo?.titulo}" foi confirmado! Devolução até ${fmtDate(dataDevolucao)}.`);
    setConfirmarSol(null);
    showToast("Solicitação confirmada e leitor notificado.");
  }

  function recusarSolicitacao(sol, justificativa) {
    const titulo = titulos.find((t) => t.id === sol.tituloId);
    setSolicitacoes((prev) => prev.map((s) => s.id === sol.id ? { ...s, status: "recusada", justificativaRecusa: justificativa } : s));
    sendNotif("Solicitação recusada", sol.solicitanteNome, `Sua solicitação de empréstimo de "${titulo?.titulo}" foi recusada. Motivo: ${justificativa}`);
    setRecusarSol(null);
    showToast("Solicitação recusada e leitor notificado.");
  }

  const tabs = [
    { key: "ativos", label: "Ativos" },
    { key: "todos", label: "Todos" },
    ...(isAdmin ? [{ key: "solicitacoes", label: "Solicitações", badge: pendentesCount }] : []),
  ];

  return (
    <div>
      <PageTitle
        title="Empréstimos"
        subtitle={`${emprestimos.filter((e) => e.status !== "Devolvido").length} em andamento`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" icon={Download} onClick={() => showToast("Exportação simulada.")}>Exportar</Btn>
            {isAdmin && <Btn icon={Plus} onClick={() => setFormOpen(true)}>Novo</Btn>}
          </div>
        }
      />

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "7px 14px", borderRadius: 999, border: `1px solid ${tab === t.key ? COLORS.primary : COLORS.border}`, background: tab === t.key ? COLORS.primary : "#fff", color: tab === t.key ? "#fff" : COLORS.ink, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {t.label}
            {t.badge > 0 && <span style={{ background: COLORS.danger, color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "solicitacoes" ? (
        <SolicitacoesTab solicitacoes={solicitacoes} titulos={titulos} exemplares={exemplares} onConfirmar={setConfirmarSol} onRecusar={setRecusarSol} />
      ) : (
        <>
          <SearchBar value={query} onChange={setQuery} placeholder="Buscar por locatário ou livro..." />
          {filtered.length === 0 ? (
            <EmptyState icon={RefreshCw} text="Nenhum empréstimo encontrado." />
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {filtered.map((e) => {
                const titulo = getTituloFromEmprestimo(e, exemplares, titulos);
                const isOwn = auth.perfil === "leitor" && (e.locatarioCpf === auth.cpf || e.locatario.toLowerCase().includes(auth.nome.split(" ")[0].toLowerCase()));
                const podeAgir = isAdmin || isOwn;
                return (
                  <div key={e.id} style={{ background: "#fff", border: `1px solid ${e.status === "Atrasado" ? COLORS.danger : COLORS.border}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                      <h3 style={{ margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 16 }}>{titulo?.titulo || "Livro removido"}</h3>
                      <StatusBadge status={e.status} />
                    </div>
                    <p style={{ margin: "0 0 2px", fontSize: 13, color: COLORS.neutral }}>Para: {e.locatario}</p>
                    <p style={{ margin: "0 0 2px", fontSize: 13, color: COLORS.neutral }}>Empréstimo: {fmtDate(e.dataEmprestimo)}</p>
                    <p style={{ margin: "0 0 6px", fontSize: 13, color: COLORS.neutral }}>Prazo: {fmtDate(e.dataDevolucao)}</p>
                    {e.observacoes && <p style={{ margin: "0 0 8px", fontSize: 12, fontStyle: "italic", color: COLORS.neutral }}>{e.observacoes}</p>}
                    {e.renovacao && <Badge tone="warn">Renovação {e.renovacao}</Badge>}
                    {e.status === "Devolvido" && e.dataDevolvido && (
                      <div style={{ marginTop: 8, background: COLORS.successBg, border: `1px solid ${COLORS.success}33`, borderRadius: 8, padding: "7px 11px", fontSize: 12, color: COLORS.success, display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle2 size={13} />
                        <span>Devolvido em {fmtDateTime(e.dataDevolvido)} · confirmado por <strong>{e.devolvidoPor}</strong></span>
                      </div>
                    )}
                    {(e.status === "Ativo" || e.status === "Atrasado") && podeAgir && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {isAdmin && <Btn variant="subtle" icon={CheckCircle2} onClick={() => setToReturn(e)}>Devolver</Btn>}
                        {isOwn && !e.renovacao && <Btn variant="ghost" icon={Send} onClick={() => setRenovarTarget(e)}>Solicitar renovação</Btn>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {formOpen && <NovoEmprestimoForm titulos={titulos} exemplares={exemplares} ctx={ctx} onSave={registrar} onClose={() => setFormOpen(false)} />}
      {renovarTarget && <RenovacaoForm emprestimo={renovarTarget} onSave={solicitarRenovacao} onClose={() => setRenovarTarget(null)} />}
      {toReturn && <Confirm text="Confirmar a devolução deste exemplar?" onConfirm={() => devolver(toReturn)} onCancel={() => setToReturn(null)} />}
      {confirmarSol && <ConfirmarSolicitacaoModal sol={confirmarSol} titulos={titulos} exemplares={exemplares} onConfirm={confirmarSolicitacao} onClose={() => setConfirmarSol(null)} />}
      {recusarSol && <RecusarSolicitacaoModal sol={recusarSol} onConfirm={(just) => recusarSolicitacao(recusarSol, just)} onClose={() => setRecusarSol(null)} />}
    </div>
  );
}

function SolicitacoesTab({ solicitacoes, titulos, exemplares, onConfirmar, onRecusar }) {
  const pendentes = solicitacoes.filter((s) => s.status === "pendente");
  const outras = solicitacoes.filter((s) => s.status !== "pendente").slice(0, 20);
  if (solicitacoes.length === 0) return <EmptyState icon={Clock} text="Nenhuma solicitação de empréstimo ainda." />;
  return (
    <div>
      {pendentes.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral, marginBottom: 10 }}>Pendentes ({pendentes.length})</div>
          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            {pendentes.map((s) => {
              const titulo = titulos.find((t) => t.id === s.tituloId);
              const disp = getDisponibilidadeTitulo(s.tituloId, exemplares);
              return (
                <div key={s.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 16 }}>{titulo?.titulo}</h3>
                    <Badge tone="warn">Pendente</Badge>
                  </div>
                  <p style={{ fontSize: 13, color: COLORS.neutral, margin: "0 0 2px" }}>Solicitante: <strong>{s.solicitanteNome}</strong></p>
                  <p style={{ fontSize: 12, color: COLORS.neutral, margin: "0 0 6px" }}>Solicitado em {fmtDate(s.dataSolicitacao.slice(0, 10))}{s.dataDesejada ? ` · Devolução desejada: ${fmtDate(s.dataDesejada)}` : ""}</p>
                  {disp === 0 && <div style={{ fontSize: 12, color: COLORS.danger, marginBottom: 8 }}>Nenhum exemplar disponível no momento</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="subtle" icon={CheckCircle2} onClick={() => onConfirmar(s)} disabled={disp === 0}>Confirmar</Btn>
                    <Btn variant="danger" style={{ background: "transparent" }} icon={XCircle} onClick={() => onRecusar(s)}>Recusar</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {outras.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral, marginBottom: 10 }}>Histórico</div>
          <div style={{ display: "grid", gap: 8 }}>
            {outras.map((s) => {
              const titulo = titulos.find((t) => t.id === s.tituloId);
              return (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
                  <span><strong>{s.solicitanteNome}</strong> · {titulo?.titulo}</span>
                  <Badge tone={s.status === "confirmada" ? "success" : "danger"}>{s.status}</Badge>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ConfirmarSolicitacaoModal({ sol, titulos, exemplares, onConfirm, onClose }) {
  const titulo = titulos.find((t) => t.id === sol.tituloId);
  const disponiveis = exemplares.filter((ex) => ex.tituloId === sol.tituloId && ex.status === "Disponível");
  const [exemplarId, setExemplarId] = useState(disponiveis[0]?.id || "");
  const [dataEmprestimo, setDataEmprestimo] = useState(todayISO());
  const [dataDevolucao, setDataDevolucao] = useState(sol.dataDesejada || addDays(todayISO(), 14));
  return (
    <Modal title="Confirmar Solicitação" onClose={onClose} width={440}>
      <p style={{ fontSize: 13, color: COLORS.neutral, marginTop: 0 }}>Confirmando empréstimo de <strong>{titulo?.titulo}</strong> para <strong>{sol.solicitanteNome}</strong>.</p>
      <Field label="Exemplar" required>
        <Select value={exemplarId} onChange={(e) => setExemplarId(e.target.value)}>
          {disponiveis.map((ex) => <option key={ex.id} value={ex.id}>{ex.tombo} — {ex.estadoConservacao}</option>)}
        </Select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Data empréstimo"><Input type="date" value={dataEmprestimo} onChange={(e) => setDataEmprestimo(e.target.value)} /></Field>
        <Field label="Data devolução"><Input type="date" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} min={dataEmprestimo} /></Field>
      </div>
      <Btn onClick={() => onConfirm(sol, exemplarId, dataEmprestimo, dataDevolucao)} style={{ width: "100%", justifyContent: "center" }} disabled={!exemplarId}>Confirmar empréstimo</Btn>
    </Modal>
  );
}

function RecusarSolicitacaoModal({ sol, onConfirm, onClose }) {
  const [just, setJust] = useState("");
  const [err, setErr] = useState("");
  return (
    <Modal title="Recusar Solicitação" onClose={onClose} width={420}>
      <p style={{ fontSize: 13, color: COLORS.neutral, marginTop: 0 }}>Recusando solicitação de <strong>{sol.solicitanteNome}</strong>.</p>
      <Field label="Justificativa" required><Textarea value={just} onChange={(e) => setJust(e.target.value)} placeholder="Explique o motivo da recusa..." /></Field>
      {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <Btn variant="danger" style={{ width: "100%", justifyContent: "center", background: "transparent" }} onClick={() => { if (!just.trim()) { setErr("Informe uma justificativa."); return; } onConfirm(just.trim()); }}>Confirmar recusa</Btn>
    </Modal>
  );
}

/* Part C: Novo empréstimo direto (admin) com busca de usuário */
function NovoEmprestimoForm({ titulos, exemplares, ctx, onSave, onClose }) {
  const { usuarios, setUsuarios } = ctx;
  const [tituloId, setTituloId] = useState("");
  const [exemplarId, setExemplarId] = useState("");
  const [locatarioBusca, setLocatarioBusca] = useState("");
  const [locatarioSelecionado, setLocatarioSelecionado] = useState(null); // {cpf, nome}
  const [dataDevolucao, setDataDevolucao] = useState(addDays(todayISO(), 14));
  const [observacoes, setObservacoes] = useState("");
  const [err, setErr] = useState("");
  const [cadastrando, setCadastrando] = useState(false);

  const exsDisponiveis = exemplares.filter((ex) => ex.tituloId === tituloId && ex.status === "Disponível");

  useEffect(() => {
    setExemplarId(exsDisponiveis[0]?.id || "");
  }, [tituloId]);

  const resultadosBusca = locatarioBusca.trim().length >= 2
    ? usuarios.filter((u) => u.nome.toLowerCase().includes(locatarioBusca.toLowerCase()) || u.cpf.includes(locatarioBusca.replace(/\D/g, "")))
    : [];

  function submit(e) {
    e.preventDefault();
    if (!tituloId || !exemplarId) { setErr("Selecione um título e exemplar disponível."); return; }
    if (!locatarioSelecionado) { setErr("Selecione um locatário."); return; }
    if (!dataDevolucao) { setErr("Informe a data de devolução."); return; }
    onSave({ exemplarId, tituloId, locatario: locatarioSelecionado.nome, locatarioCpf: locatarioSelecionado.cpf, dataDevolucao, observacoes });
  }

  function selecionarLocatario(u) {
    setLocatarioSelecionado({ cpf: u.cpf, nome: u.nome });
    setLocatarioBusca(u.nome);
    setCadastrando(false);
  }

  function salvarNovoCadastro(novoUsuario) {
    setUsuarios((prev) => [...prev, novoUsuario]);
    selecionarLocatario(novoUsuario);
  }

  return (
    <Modal title="Novo Empréstimo" onClose={onClose} width={500}>
      <form onSubmit={submit}>
        <Field label="Título" required>
          <Select value={tituloId} onChange={(e) => setTituloId(e.target.value)}>
            <option value="">Selecione um título</option>
            {titulos.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
          </Select>
        </Field>
        {tituloId && (
          <Field label="Exemplar disponível" required>
            {exsDisponiveis.length === 0
              ? <div style={{ fontSize: 13, color: COLORS.danger }}>Nenhum exemplar disponível para este título.</div>
              : <Select value={exemplarId} onChange={(e) => setExemplarId(e.target.value)}>
                  {exsDisponiveis.map((ex) => <option key={ex.id} value={ex.id}>{ex.tombo} — {ex.estadoConservacao}</option>)}
                </Select>
            }
          </Field>
        )}

        <Field label="Locatário" required hint="Busque por nome ou CPF">
          <div style={{ position: "relative" }}>
            <Input value={locatarioBusca} onChange={(e) => { setLocatarioBusca(e.target.value); setLocatarioSelecionado(null); setCadastrando(false); }} placeholder="Digite nome ou CPF..." />
            {locatarioSelecionado && <div style={{ position: "absolute", right: 10, top: 10, color: COLORS.success }}><CheckCircle2 size={16} /></div>}
          </div>
          {resultadosBusca.length > 0 && !locatarioSelecionado && (
            <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, marginTop: 4, overflow: "hidden" }}>
              {resultadosBusca.slice(0, 5).map((u) => (
                <button key={u.cpf} type="button" onClick={() => selecionarLocatario(u)} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", fontSize: 13 }}>
                  <strong>{u.nome}</strong> <span style={{ color: COLORS.neutral }}>· {u.cpf}</span>
                </button>
              ))}
            </div>
          )}
          {locatarioBusca.trim().length >= 2 && resultadosBusca.length === 0 && !locatarioSelecionado && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.neutral }}>
              Nenhum usuário encontrado.
              <Btn type="button" variant="ghost" icon={UserPlus} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setCadastrando(true)}>Cadastrar</Btn>
            </div>
          )}
        </Field>

        {cadastrando && (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 12, background: COLORS.bgAlt }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Novo cadastro rápido</div>
            <CadastroRapidoLocatario usuariosExistentes={usuarios} onSave={salvarNovoCadastro} onCancel={() => setCadastrando(false)} />
          </div>
        )}

        <Field label="Data de Devolução" required>
          <Input type="date" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} min={todayISO()} />
        </Field>
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Field>
        {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <Btn type="submit" style={{ width: "100%", justifyContent: "center" }}>Registrar Empréstimo</Btn>
      </form>
    </Modal>
  );
}

function CadastroRapidoLocatario({ usuariosExistentes, onSave, onCancel }) {
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (!cpfLimpo || cpfLimpo.length !== 11) { setErr("CPF deve ter 11 dígitos."); return; }
    if (usuariosExistentes.some((u) => u.cpf === cpfLimpo)) { setErr("Já existe usuário com este CPF."); return; }
    if (!nome.trim()) { setErr("Nome é obrigatório."); return; }
    onSave({ cpf: cpfLimpo, nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), perfil: "leitor", senha: cpfLimpo, ativo: true, tokenSenha: null });
  }

  return (
    <form onSubmit={submit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="CPF" required><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="00000000000" /></Field>
        <Field label="Nome" required><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
      </div>
      {err && <div style={{ color: COLORS.danger, fontSize: 12, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn type="submit" style={{ flex: 1, justifyContent: "center" }}>Cadastrar e selecionar</Btn>
        <Btn type="button" variant="ghost" onClick={onCancel}>Cancelar</Btn>
      </div>
    </form>
  );
}

function RenovacaoForm({ emprestimo, onSave, onClose }) {
  const [justificativa, setJustificativa] = useState("");
  const [novaData, setNovaData] = useState(addDays(emprestimo.dataDevolucao, 14));
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!justificativa.trim()) { setErr("A justificativa é obrigatória."); return; }
    onSave(emprestimo, justificativa.trim(), novaData);
  }

  return (
    <Modal title="Solicitar Renovação" onClose={onClose}>
      <form onSubmit={submit}>
        <p style={{ fontSize: 13, color: COLORS.neutral, marginTop: 0 }}>
          Prazo atual: <strong>{fmtDate(emprestimo.dataDevolucao)}</strong>
        </p>
        <Field label="Justificativa" required hint="Explique por que precisa de mais tempo com o livro.">
          <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Ex: ainda não terminei a leitura para o grupo de estudo..." />
        </Field>
        <Field label="Nova data sugerida">
          <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
        </Field>
        {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <Btn type="submit" style={{ width: "100%", justifyContent: "center" }}>Enviar solicitação</Btn>
      </form>
    </Modal>
  );
}

/* =========================================================================
   SCREEN: RENOVAÇÕES (Admin)
   ========================================================================= */
function RenovacoesAdminScreen({ ctx }) {
  const { renovacoes, setRenovacoes, emprestimos, setEmprestimos, titulos, exemplares, sendNotif, showToast } = ctx;
  const [decidindo, setDecidindo] = useState(null);

  const pendentes = renovacoes.filter((r) => r.status === "Solicitada");
  const decididas = renovacoes.filter((r) => r.status !== "Solicitada").slice(0, 8);

  function getTitulo(r) {
    const emp = emprestimos.find((e) => e.id === r.emprestimoId);
    return emp ? getTituloFromEmprestimo(emp, exemplares, titulos) : null;
  }

  function aprovar(r, novaData) {
    setRenovacoes((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "Aprovada", novaData } : x)));
    setEmprestimos((prev) => prev.map((e) => (e.id === r.emprestimoId ? { ...e, dataDevolucao: novaData, status: "Ativo", renovacao: "Aprovada" } : e)));
    const titulo = getTitulo(r);
    sendNotif("Renovação aprovada", r.locatario, `Sua renovação foi aprovada! Novo prazo de devolução de "${titulo?.titulo}": ${fmtDate(novaData)}.`);
    showToast("Renovação aprovada e leitor notificado (simulado).");
    setDecidindo(null);
  }

  function recusar(r, justificativaAdmin) {
    setRenovacoes((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "Recusada", justificativaAdmin } : x)));
    setEmprestimos((prev) => prev.map((e) => (e.id === r.emprestimoId ? { ...e, renovacao: "Recusada" } : e)));
    const titulo = getTitulo(r);
    sendNotif("Renovação recusada", r.locatario, `Sua solicitação de renovação para "${titulo?.titulo}" foi recusada. Motivo: ${justificativaAdmin}`);
    showToast("Renovação recusada e leitor notificado (simulado).");
    setDecidindo(null);
  }

  return (
    <div>
      <PageTitle title="Fila de Renovações" subtitle={`${pendentes.length} solicitação(ões) pendente(s)`} />
      {pendentes.length === 0 ? (
        <EmptyState icon={RefreshCw} text="Nenhuma solicitação de renovação pendente." />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {pendentes.map((r) => {
            const titulo = getTitulo(r);
            return (
              <div key={r.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 16 }}>{titulo?.titulo}</h3>
                  <Badge tone="warn">Solicitada</Badge>
                </div>
                <p style={{ fontSize: 13, color: COLORS.neutral, margin: "4px 0" }}>Locatário: {r.locatario}</p>
                <p style={{ fontSize: 13, margin: "6px 0", fontStyle: "italic" }}>&ldquo;{r.justificativa}&rdquo;</p>
                <p style={{ fontSize: 12, color: COLORS.neutral, margin: "0 0 10px" }}>Nova data sugerida pelo leitor: {fmtDate(r.novaDataSugerida)}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="subtle" icon={CheckCircle2} onClick={() => setDecidindo({ r, tipo: "aprovar" })}>Aprovar</Btn>
                  <Btn variant="danger" icon={XCircle} onClick={() => setDecidindo({ r, tipo: "recusar" })}>Recusar</Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {decididas.length > 0 && (
        <Section title="Decididas recentemente">
          <div style={{ display: "grid", gap: 8 }}>
            {decididas.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span>{r.locatario} — {getTitulo(r)?.titulo}</span>
                <StatusBadge status={r.status === "Aprovada" ? "Devolvido" : "Atrasado"} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {decidindo?.tipo === "aprovar" && (
        <AprovarRenovacaoModal renovacao={decidindo.r} onConfirm={aprovar} onClose={() => setDecidindo(null)} />
      )}
      {decidindo?.tipo === "recusar" && (
        <RecusarRenovacaoModal renovacao={decidindo.r} onConfirm={recusar} onClose={() => setDecidindo(null)} />
      )}
    </div>
  );
}

function AprovarRenovacaoModal({ renovacao, onConfirm, onClose }) {
  const [novaData, setNovaData] = useState(renovacao.novaDataSugerida);
  return (
    <Modal title="Aprovar Renovação" onClose={onClose} width={420}>
      <Field label="Nova data de devolução" required>
        <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
      </Field>
      <Btn onClick={() => onConfirm(renovacao, novaData)} style={{ width: "100%", justifyContent: "center" }}>Confirmar aprovação</Btn>
    </Modal>
  );
}
function RecusarRenovacaoModal({ renovacao, onConfirm, onClose }) {
  const [just, setJust] = useState("");
  const [err, setErr] = useState("");
  return (
    <Modal title="Recusar Renovação" onClose={onClose} width={420}>
      <Field label="Justificativa" required>
        <Textarea value={just} onChange={(e) => setJust(e.target.value)} placeholder="Explique o motivo da recusa..." />
      </Field>
      {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <Btn variant="danger" style={{ width: "100%", justifyContent: "center", background: "transparent" }}
        onClick={() => { if (!just.trim()) { setErr("Informe uma justificativa."); return; } onConfirm(renovacao, just.trim()); }}>
        Confirmar recusa
      </Btn>
    </Modal>
  );
}

/* =========================================================================
   SCREEN: NOTIFICAÇÕES — Configuração (Admin)
   ========================================================================= */
function NotificacoesConfigScreen({ ctx }) {
  const { configNotif, setConfigNotif, showToast } = ctx;
  const [editing, setEditing] = useState(null);

  function save(updated) {
    setConfigNotif((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditing(null);
    showToast("Configuração salva. Vale para os próximos disparos.");
  }

  return (
    <div>
      <PageTitle title="Configuração de Notificações" subtitle="Ajuste destinatário, mensagem, horário e gatilho de cada envio automático." />
      <div style={{ display: "grid", gap: 12 }}>
        {configNotif.map((c) => (
          <div key={c.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 16 }}>{c.nome}</h3>
                <p style={{ fontSize: 12, color: COLORS.neutral, margin: "4px 0" }}>Gatilho: {c.gatilho} · Horário: {c.horario} · Destinatário: {c.destinatario}</p>
                <p style={{ fontSize: 13, margin: "8px 0 0", background: COLORS.bgAlt, padding: 10, borderRadius: 8 }}>{c.texto}</p>
              </div>
              <Btn variant="ghost" icon={Edit2} onClick={() => setEditing(c)}>Editar</Btn>
            </div>
          </div>
        ))}
      </div>
      {editing && <ConfigNotifForm config={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ConfigNotifForm({ config, onSave, onClose }) {
  const [data, setData] = useState({ ...config });
  function set(k, v) { setData((d) => ({ ...d, [k]: v })); }
  return (
    <Modal title={`Editar: ${config.nome}`} onClose={onClose} width={480}>
      <Field label="Destinatário"><Input value={data.destinatario} onChange={(e) => set("destinatario", e.target.value)} /></Field>
      <Field label="Horário de envio"><Input type="time" value={data.horario} onChange={(e) => set("horario", e.target.value)} /></Field>
      <Field label="Gatilho / condição de disparo"><Input value={data.gatilho} onChange={(e) => set("gatilho", e.target.value)} /></Field>
      <Field label="Texto da mensagem" hint="Variáveis disponíveis: {nome_locatario}, {nome_livro}, {data_devolucao}">
        <Textarea value={data.texto} onChange={(e) => set("texto", e.target.value)} />
      </Field>
      <Btn onClick={() => onSave(data)} style={{ width: "100%", justifyContent: "center" }}>Salvar configuração</Btn>
    </Modal>
  );
}

/* =========================================================================
   SCREEN: LOG DE NOTIFICAÇÕES (Admin) — simulação de mensageria enviada
   ========================================================================= */
function NotifLogScreen({ ctx }) {
  const { notifLog } = ctx;
  return (
    <div>
      <PageTitle title="Log de Mensagens" subtitle="Histórico simulado de envios via WhatsApp/SMS (não são mensagens reais)." />
      {notifLog.length === 0 ? (
        <EmptyState icon={Bell} text="Nenhuma mensagem enviada ainda." />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {notifLog.map((n) => (
            <div key={n.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <Badge tone="accent">{n.tipo}</Badge>
                <span style={{ fontSize: 11, color: COLORS.neutral }}>{fmtDateTime(n.data)}</span>
              </div>
              <p style={{ fontSize: 13, margin: "6px 0 2px" }}><strong>Para:</strong> {n.destinatario}</p>
              <p style={{ fontSize: 13, margin: 0 }}>{n.texto}</p>
              <p style={{ fontSize: 11, color: COLORS.neutral, margin: "6px 0 0" }}>{n.canal}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   SCREEN: LEITURA
   ========================================================================= */
function LeituraScreen({ ctx }) {
  const { leituras, setLeituras, titulos, showToast } = ctx;
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = leituras.filter((l) => {
    const titulo = titulos.find((t) => t.id === l.livroId);
    return !query || (titulo && titulo.titulo.toLowerCase().includes(query.toLowerCase()));
  });

  function add(livroId) {
    if (leituras.some((l) => l.livroId === livroId)) { showToast("Este livro já está em leitura."); return; }
    setLeituras((prev) => [...prev, { id: uid("LE"), livroId, progresso: 0, inicio: todayISO() }]);
    setFormOpen(false);
  }
  function updateProgresso(id, progresso) {
    setLeituras((prev) => prev.map((l) => (l.id === id ? { ...l, progresso } : l)));
  }
  function remover(id) {
    setLeituras((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div>
      <PageTitle title="Leitura" subtitle="Acompanhe seu progresso de leitura" action={<Btn icon={Plus} onClick={() => setFormOpen(true)}>Novo</Btn>} />
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar livros..." />
      {filtered.length === 0 ? (
        <EmptyState icon={BookMarked} text="Nenhum livro em leitura." />
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {filtered.map((l) => {
            const titulo = titulos.find((t) => t.id === l.livroId);
            return (
              <div key={l.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 16 }}>{titulo?.titulo}</h3>
                  <Btn variant="icon" onClick={() => remover(l.id)}><Trash2 size={14} /></Btn>
                </div>
                <p style={{ fontSize: 12, color: COLORS.neutral, margin: "4px 0 10px" }}>Iniciado em {fmtDate(l.inicio)}</p>
                <div style={{ background: COLORS.bgAlt, borderRadius: 999, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${l.progresso}%`, height: "100%", background: COLORS.primary, borderRadius: 999 }} />
                </div>
                <input type="range" min={0} max={100} value={l.progresso} onChange={(e) => updateProgresso(l.id, Number(e.target.value))} style={{ width: "100%", marginTop: 8 }} />
                <p style={{ fontSize: 12, color: COLORS.neutral, margin: "4px 0 0", textAlign: "right" }}>{l.progresso}% concluído</p>
              </div>
            );
          })}
        </div>
      )}
      {formOpen && (
        <Modal title="Iniciar Leitura" onClose={() => setFormOpen(false)} width={420}>
          <p style={{ fontSize: 13, color: COLORS.neutral, marginTop: 0 }}>Selecione um livro para acompanhar:</p>
          <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
            {titulos.map((t) => (
              <button key={t.id} onClick={() => add(t.id)} style={{
                textAlign: "left", background: COLORS.bgAlt, border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}>
                {t.titulo} <span style={{ color: COLORS.neutral, fontSize: 12 }}> · {t.autor}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =========================================================================
   SCREEN: LISTA DE DESEJOS
   ========================================================================= */
function ListaDesejosScreen({ ctx, setRoute }) {
  const { desejos, addDesejo, removeDesejo, titulos } = ctx;
  const [adding, setAdding] = useState(desejos.length === 0);

  useEffect(() => {
    if (desejos.length === 0) setAdding(true);
  }, [desejos.length]);

  return (
    <div>
      <PageTitle
        title="Lista de Desejos"
        subtitle={`${desejos.length} ${desejos.length === 1 ? "livro desejado" : "livros desejados"}`}
        action={<Btn icon={Plus} onClick={() => setAdding((v) => !v)}>{adding ? "Fechar" : "Adicionar livro à lista"}</Btn>}
      />

      {desejos.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "34px 18px", textAlign: "center", marginBottom: 16 }}>
          <Heart size={38} color={COLORS.accent} style={{ marginBottom: 10 }} />
          <p style={{ margin: "0 0 14px", color: COLORS.neutral, fontSize: 14 }}>
            Sua lista de desejos está vazia. Busque um livro abaixo para começar.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
          {desejos.map((item) => {
            const match = findCatalogMatch(item, titulos);
            return (
              <WishlistCard
                key={item.id}
                item={item}
                match={match}
                onOpenMatch={() => match && setRoute("livros", { livroId: match.id })}
                onRemove={() => removeDesejo(item.id)}
              />
            );
          })}
        </div>
      )}

      {adding && (
        <div style={{
          background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14,
          padding: 16, display: "grid", gap: 18,
        }}>
          <GoogleBooksWishSearch onAdd={addDesejo} />
          <div style={{ height: 1, background: COLORS.border }} />
          <ManualWishForm onAdd={addDesejo} />
        </div>
      )}
    </div>
  );
}

function WishlistCard({ item, match, onOpenMatch, onRemove }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14,
      padding: 12, display: "flex", gap: 12, alignItems: "center",
    }}>
      <div style={{
        width: 62, height: 88, borderRadius: 8, background: COLORS.bgAlt, flexShrink: 0,
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${COLORS.border}`,
      }}>
        {item.capaUrl ? (
          <img src={item.capaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <BookOpen size={24} color={COLORS.neutral} style={{ opacity: 0.45 }} />
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3 style={{
          margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 17,
          color: COLORS.primaryDark, overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {item.titulo}
        </h3>
        <p style={{ margin: "3px 0 8px", color: COLORS.neutral, fontSize: 13 }}>{item.autor || "Autor não informado"}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge tone={item.origem === "google_books" ? "accent" : "neutral"}>{item.origem === "google_books" ? "Google Books" : "Manual"}</Badge>
          {match && (
            <button
              type="button"
              onClick={onOpenMatch}
              style={{
                border: "none", background: COLORS.successBg, color: COLORS.success,
                borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                fontFamily: "Inter, sans-serif",
              }}
            >
              <CheckCircle2 size={13} /> Já disponível no acervo
            </button>
          )}
        </div>
      </div>
      <Btn variant="icon" onClick={onRemove} title="Remover" style={{ color: COLORS.danger, flexShrink: 0 }}>
        <Trash2 size={15} />
      </Btn>
    </div>
  );
}

function GoogleBooksWishSearch({ onAdd }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setError("");
      setLoading(false);
      setSearched(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("google-books");
        const data = await res.json();
        const items = (data.items || []).slice(0, 8).map((volume) => {
          const info = volume.volumeInfo || {};
          return {
            id: volume.id,
            titulo: info.title || "",
            autor: Array.isArray(info.authors) ? info.authors.join(", ") : "",
            capaUrl: (info.imageLinks?.thumbnail || "").replace(/^http:/, "https:"),
          };
        }).filter((book) => book.titulo);
        setResults(items);
        setSearched(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          setResults([]);
          setError("Não foi possível buscar agora. Tente novamente.");
          setSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div>
      <h2 style={{ margin: "0 0 10px", fontFamily: "'Source Serif 4', serif", fontSize: 19, color: COLORS.primaryDark }}>Buscar no Google Books</h2>
      <SearchBar value={query} onChange={setQuery} placeholder="Digite título ou autor..." />
      {loading && <p style={{ fontSize: 13, color: COLORS.neutral, margin: "10px 0 0" }}>Buscando...</p>}
      {error && <p style={{ fontSize: 13, color: COLORS.danger, margin: "10px 0 0" }}>{error}</p>}
      {!loading && searched && !error && results.length === 0 && (
        <p style={{ fontSize: 13, color: COLORS.neutral, margin: "10px 0 0" }}>Nenhum livro encontrado para sua busca.</p>
      )}
      {results.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {results.map((book) => (
            <div key={book.id} style={{
              display: "flex", gap: 10, alignItems: "center", border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: 10, background: COLORS.bg,
            }}>
              <div style={{
                width: 44, height: 62, background: COLORS.bgAlt, borderRadius: 6, flexShrink: 0,
                overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {book.capaUrl ? <img src={book.capaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <BookOpen size={18} color={COLORS.neutral} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 14, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.titulo}</strong>
                <span style={{ fontSize: 12, color: COLORS.neutral }}>{book.autor || "Autor não informado"}</span>
              </div>
              <Btn variant="ghost" icon={Plus} onClick={() => onAdd({ ...book, origem: "google_books" })}>Adicionar</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManualWishForm({ onAdd }) {
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErr("O título é obrigatório.");
      return;
    }
    const ok = await onAdd({ titulo, autor, capaUrl: null, origem: "manual" });
    if (ok) {
      setTitulo("");
      setAutor("");
      setErr("");
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 style={{ margin: "0 0 10px", fontFamily: "'Source Serif 4', serif", fontSize: 19, color: COLORS.primaryDark }}>Cadastro manual</h2>
      <Field label="Título" required>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </Field>
      <Field label="Autor">
        <Input value={autor} onChange={(e) => setAutor(e.target.value)} />
      </Field>
      {err && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 10px" }}>{err}</p>}
      <Btn type="submit" icon={Plus}>Adicionar manualmente</Btn>
    </form>
  );
}

/* =========================================================================
   SCREEN: PERFIL
   ========================================================================= */
function PerfilScreen({ ctx }) {
  const { auth, usuarios, setUsuarios, setAuth, showToast } = ctx;
  const user = usuarios.find((u) => u.cpf === auth.cpf) || auth;
  const [nome, setNome] = useState(user.nome || "");
  const [email, setEmail] = useState(user.email || auth.email || "");
  const [telefone, setTelefone] = useState(user.telefone || auth.telefone || "");
  const [foto, setFoto] = useState(user.foto || auth.foto || null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setErr("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErr("A imagem é grande demais para salvar no navegador. Use um arquivo de até 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFoto(reader.result);
      setErr("");
      setSaved(false);
    };
    reader.readAsDataURL(file);
  }

  function submit(e) {
    e.preventDefault();
    if (!nome.trim()) {
      setErr("O nome é obrigatório.");
      return;
    }
    const updated = {
      ...user,
      cpf: auth.cpf,
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      perfil: user.perfil || auth.perfil,
      foto,
    };
    setUsuarios((prev) => {
      let found = false;
      const next = prev.map((u) => {
        if (u.cpf !== auth.cpf) return u;
        found = true;
        return { ...u, ...updated, senha: u.senha };
      });
      return found ? next : [...next, updated];
    });
    setAuth((prev) => ({ ...prev, nome: updated.nome, email: updated.email, telefone: updated.telefone, foto: updated.foto, perfil: updated.perfil }));
    setErr("");
    setSaved(true);
    showToast("Perfil atualizado.");
  }

  return (
    <div>
      <PageTitle title="Meu perfil" subtitle="Dados pessoais da sua conta" />
      <form onSubmit={submit} style={{
        background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14,
        padding: 18, maxWidth: 640,
      }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
          <Avatar user={{ nome, foto }} size={78} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Foto do usuário</label>
            <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleFile} style={{ fontSize: 12 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {foto && <Btn type="button" variant="ghost" icon={X} onClick={() => { setFoto(null); setSaved(false); }}>Remover foto</Btn>}
            </div>
          </div>
        </div>

        <Field label="Nome" required>
          <Input value={nome} onChange={(e) => { setNome(e.target.value); setSaved(false); }} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="CPF">
            <Input value={auth.cpf} readOnly style={{ background: COLORS.bgAlt, color: COLORS.neutral }} />
          </Field>
          <Field label="Perfil">
            <Input value={user.perfil || auth.perfil} readOnly style={{ background: COLORS.bgAlt, color: COLORS.neutral, textTransform: "capitalize" }} />
          </Field>
        </div>
        <Field label="Email">
          <Input value={email} onChange={(e) => { setEmail(e.target.value); setSaved(false); }} />
        </Field>
        <Field label="Telefone">
          <Input value={telefone} onChange={(e) => { setTelefone(e.target.value); setSaved(false); }} />
        </Field>

        {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        {saved && (
          <div style={{ color: COLORS.success, background: COLORS.successBg, borderRadius: 8, padding: "8px 10px", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={15} /> Alterações salvas.
          </div>
        )}
        <Btn type="submit" icon={CheckCircle2}>Salvar alterações</Btn>
      </form>
    </div>
  );
}

/* =========================================================================
   SCREEN: ANOTAÇÕES
   ========================================================================= */
function AnotacoesScreen({ ctx }) {
  const { anotacoes, setAnotacoes, titulos } = ctx;
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const filtered = anotacoes.filter((a) => !query || a.texto.toLowerCase().includes(query.toLowerCase()) || a.titulo.toLowerCase().includes(query.toLowerCase()));

  function save(data) {
    if (editing) setAnotacoes((prev) => prev.map((a) => (a.id === editing.id ? { ...a, ...data } : a)));
    else setAnotacoes((prev) => [{ id: uid("A"), data: new Date().toISOString(), ...data }, ...prev]);
    setFormOpen(false);
    setEditing(null);
  }

  return (
    <div>
      <PageTitle title="Anotações" subtitle="Notas pessoais sobre os livros" action={<Btn icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>Novo</Btn>} />
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar anotações..." />
      {filtered.length === 0 ? (
        <EmptyState icon={StickyNote} text="Nenhuma anotação encontrada." />
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {filtered.map((a) => (
            <div key={a.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 16 }}>{a.titulo}</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn variant="icon" onClick={() => { setEditing(a); setFormOpen(true); }}><Edit2 size={14} /></Btn>
                  <Btn variant="icon" onClick={() => setToDelete(a)}><Trash2 size={14} /></Btn>
                </div>
              </div>
              <Stars value={a.nota} size={14} />
              <p style={{ fontSize: 13, margin: "8px 0 4px" }}>{a.texto}</p>
              <p style={{ fontSize: 11, color: COLORS.neutral, margin: 0 }}>{fmtDateTime(a.data)}</p>
            </div>
          ))}
        </div>
      )}
      {formOpen && <AnotacaoForm initial={editing} titulos={titulos} onSave={save} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {toDelete && <Confirm text="Excluir esta anotação?" onConfirm={() => { setAnotacoes((prev) => prev.filter((a) => a.id !== toDelete.id)); setToDelete(null); }} onCancel={() => setToDelete(null)} />}
    </div>
  );
}

function AnotacaoForm({ initial, titulos, onSave, onClose }) {
  const [livroId, setLivroId] = useState(initial?.livroId || (titulos[0]?.id ?? ""));
  const [nota, setNota] = useState(initial?.nota || 0);
  const [texto, setTexto] = useState(initial?.texto || "");

  function submit(e) {
    e.preventDefault();
    const titulo = titulos.find((t) => t.id === livroId);
    onSave({ livroId, titulo: titulo?.titulo || "Anotação", nota, texto });
  }

  return (
    <Modal title={initial ? "Editar Anotação" : "Nova Anotação"} onClose={onClose} width={420}>
      <form onSubmit={submit}>
        <Field label="Livro" required>
          <Select value={livroId} onChange={(e) => setLivroId(e.target.value)}>
            {titulos.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
          </Select>
        </Field>
        <Field label="Nota"><Stars value={nota} onChange={setNota} /></Field>
        <Field label="Anotação" required><Textarea value={texto} onChange={(e) => setTexto(e.target.value)} /></Field>
        <Btn type="submit" style={{ width: "100%", justifyContent: "center" }}>Salvar</Btn>
      </form>
    </Modal>
  );
}

/* =========================================================================
   SCREEN: COMUNIDADE
   ========================================================================= */
const PRIORIDADES_SUG = ["Alta", "Média", "Baixa"];
const STATUS_SUG = ["Em análise", "Planejado", "Em desenvolvimento", "Concluído", "Recusado"];
const STATUS_SUG_COLORS = { "Em análise": "#6366f1", "Planejado": "#0891b2", "Em desenvolvimento": "#d97706", "Concluído": COLORS.success, "Recusado": COLORS.danger };
const PRIORIDADE_COLORS = { "Alta": COLORS.danger, "Média": "#d97706", "Baixa": COLORS.neutral };

function ComunidadeScreen({ ctx }) {
  const { posts, setPosts, grupos, setGrupos, auth, sugestoes, setSugestoes } = ctx;
  const isAdmin = auth.perfil === "administrador";
  const [tab, setTab] = useState("feed");
  const [novoPost, setNovoPost] = useState("");
  const [novoComentario, setNovoComentario] = useState({});
  const [grupoForm, setGrupoForm] = useState(false);
  const [grupoAtivo, setGrupoAtivo] = useState(null);

  function publicar() {
    if (!novoPost.trim()) return;
    setPosts((prev) => [{ id: uid("P"), autor: auth.nome, texto: novoPost.trim(), data: new Date().toISOString(), likes: [], comentarios: [] }, ...prev]);
    setNovoPost("");
  }
  function curtir(postId) {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const has = p.likes.includes(auth.nome);
      return { ...p, likes: has ? p.likes.filter((n) => n !== auth.nome) : [...p.likes, auth.nome] };
    }));
  }
  function comentar(postId) {
    const texto = (novoComentario[postId] || "").trim();
    if (!texto) return;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comentarios: [...p.comentarios, { autor: auth.nome, texto, data: new Date().toISOString() }] } : p)));
    setNovoComentario((prev) => ({ ...prev, [postId]: "" }));
  }
  function criarGrupo(nome, descricao) {
    setGrupos((prev) => [...prev, { id: uid("G"), nome, descricao, membros: [auth.nome], posts: [] }]);
    setGrupoForm(false);
  }
  function entrarSair(g) {
    setGrupos((prev) => prev.map((x) => {
      if (x.id !== g.id) return x;
      const inGroup = x.membros.includes(auth.nome);
      return { ...x, membros: inGroup ? x.membros.filter((m) => m !== auth.nome) : [...x.membros, auth.nome] };
    }));
  }

  const tabItems = [
    { key: "feed", label: "Feed" },
    { key: "grupos", label: "Grupos" },
    { key: "sugestoes", label: "Sugestões" },
  ];

  return (
    <div>
      <PageTitle title="Comunidade" subtitle="Feed, grupos e sugestões de acervo" />
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {tabItems.map((t) => (
          <Btn key={t.key} variant={tab === t.key ? "primary" : "ghost"} onClick={() => { setTab(t.key); setGrupoAtivo(null); }}>{t.label}</Btn>
        ))}
      </div>

      {tab === "feed" && (
        <div>
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <Textarea value={novoPost} onChange={(e) => setNovoPost(e.target.value)} placeholder="Compartilhe algo com a comunidade..." />
            <Btn onClick={publicar} style={{ marginTop: 8 }} icon={Send}>Publicar</Btn>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} auth={auth} onCurtir={() => curtir(p.id)} onComentar={() => comentar(p.id)} comentarioVal={novoComentario[p.id] || ""} setComentarioVal={(v) => setNovoComentario((prev) => ({ ...prev, [p.id]: v }))} />
            ))}
          </div>
        </div>
      )}

      {tab === "grupos" && !grupoAtivo && (
        <div>
          <Btn icon={Plus} onClick={() => setGrupoForm(true)} style={{ marginBottom: 14 }}>Criar grupo</Btn>
          <div style={{ display: "grid", gap: 12 }}>
            {grupos.map((g) => (
              <div key={g.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 16 }}>{g.nome}</h3>
                  <Badge>{g.membros.length} membro(s)</Badge>
                </div>
                <p style={{ fontSize: 13, color: COLORS.neutral, margin: "6px 0 10px" }}>{g.descricao}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant={g.membros.includes(auth.nome) ? "subtle" : "ghost"} onClick={() => entrarSair(g)}>
                    {g.membros.includes(auth.nome) ? "Sair do grupo" : "Entrar no grupo"}
                  </Btn>
                  {g.membros.includes(auth.nome) && <Btn variant="ghost" onClick={() => setGrupoAtivo(g.id)}>Ver publicações</Btn>}
                </div>
              </div>
            ))}
          </div>
          {grupoForm && <GrupoForm onSave={criarGrupo} onClose={() => setGrupoForm(false)} />}
        </div>
      )}

      {tab === "grupos" && grupoAtivo && (
        <GrupoDetalhe grupo={grupos.find((g) => g.id === grupoAtivo)} setGrupos={setGrupos} auth={auth} onBack={() => setGrupoAtivo(null)} />
      )}

      {tab === "sugestoes" && (
        <SugestoesTab sugestoes={sugestoes} setSugestoes={setSugestoes} auth={auth} isAdmin={isAdmin} />
      )}
    </div>
  );
}

/* Part E: Sugestões tab */
function SugestoesTab({ sugestoes, setSugestoes, auth, isAdmin }) {
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDesc, setNovaDesc] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [err, setErr] = useState("");

  const sorted = [...sugestoes].sort((a, b) => b.votos.length - a.votos.length);

  function votar(id) {
    setSugestoes((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const voted = s.votos.includes(auth.cpf);
      return { ...s, votos: voted ? s.votos.filter((c) => c !== auth.cpf) : [...s.votos, auth.cpf] };
    }));
  }

  function publicar(e) {
    e.preventDefault();
    if (!novoTitulo.trim() || !novaDesc.trim()) { setErr("Título e descrição são obrigatórios."); return; }
    setSugestoes((prev) => [...prev, { id: uid("SG"), titulo: novoTitulo.trim(), descricao: novaDesc.trim(), autorNome: auth.nome, autorCpf: auth.cpf, data: new Date().toISOString(), votos: [], prioridade: null, statusSugestao: "Em análise" }]);
    setNovoTitulo(""); setNovaDesc(""); setFormOpen(false); setErr("");
  }

  function adminUpdate(id, campo, valor) {
    setSugestoes((prev) => prev.map((s) => s.id === id ? { ...s, [campo]: valor } : s));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: COLORS.neutral }}>{sugestoes.length} sugestão(ões) · ordernadas por votos</div>
        <Btn icon={Plus} onClick={() => setFormOpen((v) => !v)}>{formOpen ? "Fechar" : "Nova sugestão"}</Btn>
      </div>

      {formOpen && (
        <form onSubmit={publicar} style={{ background: "#fff", border: `1.5px solid #0d9488`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <Field label="Título da sugestão" required><Input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} placeholder="Ex: Adicionar livros de Clarice Lispector" /></Field>
          <Field label="Descrição" required><Textarea value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} placeholder="Por que este livro seria valioso para o acervo?" /></Field>
          {err && <div style={{ color: COLORS.danger, fontSize: 12, marginBottom: 8 }}>{err}</div>}
          <Btn type="submit" style={{ background: "#0d9488" }}>Enviar sugestão</Btn>
        </form>
      )}

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: COLORS.neutral }}>
          <Layers size={36} style={{ opacity: 0.35, marginBottom: 10 }} />
          <div style={{ fontSize: 14 }}>Nenhuma sugestão ainda. Seja o primeiro a sugerir um título!</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((s) => {
            const voted = s.votos.includes(auth.cpf);
            const stColor = STATUS_SUG_COLORS[s.statusSugestao] || COLORS.neutral;
            const prColor = s.prioridade ? PRIORIDADE_COLORS[s.prioridade] : COLORS.neutral;
            return (
              <div key={s.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderLeft: `4px solid #0d9488`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {/* Vote column */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    <button onClick={() => votar(s.id)} style={{ background: voted ? "#0d9488" : COLORS.bgAlt, border: `1px solid ${voted ? "#0d9488" : COLORS.border}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: voted ? "#fff" : COLORS.neutral, display: "flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 700 }}>
                      <ThumbsUp size={14} /> {s.votos.length}
                    </button>
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 16, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{s.titulo}</div>
                    <div style={{ fontSize: 13, color: COLORS.neutral, marginBottom: 8 }}>{s.descricao}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
                      <span style={{ color: COLORS.neutral }}>{s.autorNome} · {fmtDate(s.data.slice(0, 10))}</span>
                      <span style={{ background: stColor + "22", color: stColor, padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>{s.statusSugestao}</span>
                      {s.prioridade && <span style={{ background: prColor + "22", color: prColor, padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>Prioridade {s.prioridade}</span>}
                    </div>
                    {/* Admin controls */}
                    {isAdmin && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <div>
                          <label style={{ fontSize: 11, color: COLORS.neutral, display: "block", marginBottom: 3 }}>Prioridade</label>
                          <Select value={s.prioridade || ""} onChange={(e) => adminUpdate(s.id, "prioridade", e.target.value || null)} style={{ fontSize: 12, padding: "4px 8px" }}>
                            <option value="">—</option>
                            {PRIORIDADES_SUG.map((p) => <option key={p} value={p}>{p}</option>)}
                          </Select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: COLORS.neutral, display: "block", marginBottom: 3 }}>Status</label>
                          <Select value={s.statusSugestao} onChange={(e) => adminUpdate(s.id, "statusSugestao", e.target.value)} style={{ fontSize: 12, padding: "4px 8px" }}>
                            {STATUS_SUG.map((st) => <option key={st} value={st}>{st}</option>)}
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, auth, onCurtir, onComentar, comentarioVal, setComentarioVal }) {
  const liked = post.likes.includes(auth.nome);
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong style={{ fontSize: 14 }}>{post.autor}</strong>
        <span style={{ fontSize: 11, color: COLORS.neutral }}>{fmtDateTime(post.data)}</span>
      </div>
      <p style={{ fontSize: 14, margin: "8px 0 10px" }}>{post.texto}</p>
      <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 12, color: COLORS.neutral }}>
        <button onClick={onCurtir} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: liked ? COLORS.accent : COLORS.neutral }}>
          <Heart size={15} fill={liked ? COLORS.accent : "none"} /> {post.likes.length}
        </button>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MessageCircle size={15} /> {post.comentarios.length}</span>
      </div>
      {post.comentarios.length > 0 && (
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {post.comentarios.map((c, i) => (
            <div key={i} style={{ fontSize: 12, background: COLORS.bgAlt, borderRadius: 8, padding: "6px 10px" }}>
              <strong>{c.autor}:</strong> {c.texto}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <Input value={comentarioVal} onChange={(e) => setComentarioVal(e.target.value)} placeholder="Comentar..." style={{ fontSize: 13 }} />
        <Btn variant="ghost" onClick={onComentar}>Enviar</Btn>
      </div>
    </div>
  );
}

function GrupoForm({ onSave, onClose }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  return (
    <Modal title="Criar Grupo de Leitura" onClose={onClose} width={420}>
      <Field label="Nome do grupo" required><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
      <Field label="Descrição"><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Field>
      <Btn onClick={() => nome.trim() && onSave(nome.trim(), descricao.trim())} style={{ width: "100%", justifyContent: "center" }}>Criar grupo</Btn>
    </Modal>
  );
}

function GrupoDetalhe({ grupo, setGrupos, auth, onBack }) {
  const [texto, setTexto] = useState("");
  if (!grupo) return null;
  function publicar() {
    if (!texto.trim()) return;
    setGrupos((prev) => prev.map((g) => (g.id === grupo.id ? { ...g, posts: [{ autor: auth.nome, texto: texto.trim(), data: new Date().toISOString() }, ...g.posts] } : g)));
    setTexto("");
  }
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, color: COLORS.neutral, cursor: "pointer", marginBottom: 14, fontSize: 13, padding: 0 }}>
        <ArrowLeft size={15} /> Voltar para grupos
      </button>
      <h2 style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.primaryDark }}>{grupo.nome}</h2>
      <p style={{ color: COLORS.neutral, fontSize: 13 }}>{grupo.descricao} · {grupo.membros.length} membro(s)</p>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Publicar para o grupo (visível apenas a membros)..." />
        <Btn onClick={publicar} style={{ marginTop: 8 }} icon={Send}>Publicar no grupo</Btn>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {grupo.posts.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.neutral }}>Nenhuma publicação neste grupo ainda.</p>
        ) : grupo.posts.map((p, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong style={{ fontSize: 13 }}>{p.autor}</strong>
              <span style={{ fontSize: 11, color: COLORS.neutral }}>{fmtDateTime(p.data)}</span>
            </div>
            <p style={{ fontSize: 13, margin: "6px 0 0" }}>{p.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   SCREEN: GESTÃO DE USUÁRIOS (Admin)
   ========================================================================= */
function GestaoUsuariosScreen({ ctx }) {
  const { usuarios, setUsuarios, emprestimos, titulos, exemplares, sendNotif, showToast, auth } = ctx;
  const [query, setQuery] = useState("");
  const [detailCpf, setDetailCpf] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [criando, setCriando] = useState(false);

  const filtered = usuarios.filter((u) => {
    const q = query.toLowerCase();
    return !q || u.nome.toLowerCase().includes(q) || u.cpf.includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  function toggleAtivo(u) {
    if (u.cpf === auth.cpf) { showToast("Você não pode inativar sua própria conta."); return; }
    const novoAtivo = u.ativo === false;
    setUsuarios((prev) => prev.map((x) => x.cpf === u.cpf ? { ...x, ativo: novoAtivo } : x));
    showToast(novoAtivo ? `${u.nome} reativado.` : `${u.nome} inativado.`);
  }

  function excluirUsuario(u) {
    if (u.cpf === auth.cpf) { showToast("Você não pode excluir sua própria conta."); return; }
    setUsuarios((prev) => prev.filter((x) => x.cpf !== u.cpf));
    setToDelete(null);
    showToast("Usuário excluído.");
  }

  function resetarSenha(u) {
    const link = `https://acervovivo.app/redefinir/${uid("tk")}`;
    sendNotif("Redefinição de senha", u.telefone || u.email || u.nome,
      `Olá ${u.nome}, use o link para redefinir sua senha: ${link} (válido por 24h).`);
    showToast(`Link de redefinição enviado para ${u.nome} (simulado).`);
  }

  function salvarEdicao(dados) {
    setUsuarios((prev) => prev.map((u) => u.cpf === editing.cpf ? { ...u, ...dados } : u));
    showToast("Dados do usuário atualizados.");
    setEditing(null);
  }


  const detailUser = detailCpf ? usuarios.find((u) => u.cpf === detailCpf) : null;
  if (detailUser) {
    return (
      <UsuarioDetalhe
        usuario={detailUser}
        emprestimos={emprestimos}
        titulos={titulos}
        exemplares={exemplares}
        onBack={() => setDetailCpf(null)}
      />
    );
  }

  return (
    <div>
      <PageTitle
        title="Gestão de Usuários"
        subtitle={`${usuarios.length} ${usuarios.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}`}
        action={<Btn icon={Plus} onClick={() => setCriando(true)}>Novo usuário</Btn>}
      />
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar por nome, CPF ou e-mail..." />

      {filtered.length === 0 ? (
        <EmptyState icon={UsersRound} text="Nenhum usuário encontrado." />
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {filtered.map((u) => {
            const ativo = u.ativo !== false;
            const isSelf = u.cpf === auth.cpf;
            return (
              <div key={u.cpf} style={{
                background: "#fff", border: `1px solid ${COLORS.border}`,
                borderRadius: 14, padding: 16, opacity: ativo ? 1 : 0.65,
              }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                    background: ativo ? COLORS.primary : COLORS.neutral,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontFamily: "'Source Serif 4', serif", fontSize: 20, fontWeight: 700,
                    overflow: "hidden",
                  }}>
                    {u.foto
                      ? <img src={u.foto} alt={u.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : u.nome.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontFamily: "'Source Serif 4', serif", fontSize: 17, color: COLORS.ink }}>{u.nome}</h3>
                      <Badge tone={u.perfil === "administrador" ? "accent" : "neutral"}>{u.perfil}</Badge>
                      {!ativo && <Badge tone="danger">Inativo</Badge>}
                      {isSelf && <Badge tone="success">Você</Badge>}
                    </div>
                    <p style={{ margin: "0 0 2px", fontSize: 13, color: COLORS.neutral }}>CPF: {u.cpf}</p>
                    {u.email && <p style={{ margin: "0 0 2px", fontSize: 13, color: COLORS.neutral }}>{u.email}</p>}
                    {u.telefone && <p style={{ margin: 0, fontSize: 13, color: COLORS.neutral }}>{u.telefone}</p>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <Btn variant="ghost" icon={History} onClick={() => setDetailCpf(u.cpf)}>Histórico</Btn>
                  <Btn variant="ghost" icon={Edit2} onClick={() => setEditing(u)}>Editar</Btn>
                  {!isSelf && (
                    <>
                      <Btn variant="ghost" icon={Key} onClick={() => resetarSenha(u)}>Resetar senha</Btn>
                      <Btn
                        variant="ghost"
                        icon={ativo ? UserMinus : UserCheck}
                        onClick={() => toggleAtivo(u)}
                        style={{ color: ativo ? COLORS.warn : COLORS.success }}
                      >
                        {ativo ? "Inativar" : "Reativar"}
                      </Btn>
                      <Btn variant="ghost" icon={Trash2} onClick={() => setToDelete(u)} style={{ color: COLORS.danger }}>Excluir</Btn>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && <UsuarioEditForm usuario={editing} onSave={salvarEdicao} onClose={() => setEditing(null)} isAdmin usuariosExistentes={usuarios} />}
      {criando && (
        <NovoUsuarioForm
          usuariosExistentes={usuarios}
          onSave={(novo) => {
            setUsuarios((prev) => [...prev, novo]);
            setCriando(false);
            const link = `https://acervovivo.app/primeiro-acesso/${novo.tokenSenha}`;
            const msg = `Olá ${novo.nome}! Sua conta no Acervo Vivo foi criada. Acesse o link para definir sua senha: ${link} (válido por 48h). Em caso de dúvidas, fale com o administrador.`;
            if (novo.email) sendNotif("Convite Acervo Vivo", novo.email, msg);
            if (novo.telefone) sendNotif("Convite Acervo Vivo", novo.telefone, msg);
            showToast(`Usuário "${novo.nome}" criado. Convite enviado por ${novo.email && novo.telefone ? "e-mail e WhatsApp/SMS" : novo.email ? "e-mail" : "WhatsApp/SMS"}.`);
          }}
          onClose={() => setCriando(false)}
        />
      )}
      {toDelete && (
        <Confirm
          text={`Excluir o usuário "${toDelete.nome}"? Esta ação não pode ser desfeita.`}
          onConfirm={() => excluirUsuario(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

function UsuarioDetalhe({ usuario, emprestimos, titulos, exemplares, onBack }) {
  const primeiroNome = usuario.nome.split(" ")[0].toLowerCase();
  const historico = emprestimos
    .filter((e) => (e.locatarioCpf ? e.locatarioCpf === usuario.cpf : e.locatario.toLowerCase().includes(primeiroNome)))
    .sort((a, b) => new Date(b.dataEmprestimo) - new Date(a.dataEmprestimo));

  const ativo = usuario.ativo !== false;

  function corDot(status) {
    if (status === "Devolvido") return COLORS.success;
    if (status === "Atrasado") return COLORS.danger;
    return COLORS.warn;
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, color: COLORS.neutral, cursor: "pointer", marginBottom: 14, fontSize: 13, padding: 0 }}>
        <ArrowLeft size={15} /> Voltar para Usuários
      </button>

      <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 28, padding: 20, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 16, flexWrap: "wrap" }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
          background: ativo ? COLORS.primary : COLORS.neutral,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontFamily: "'Source Serif 4', serif", fontSize: 30, fontWeight: 700, overflow: "hidden",
        }}>
          {usuario.foto
            ? <img src={usuario.foto} alt={usuario.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : usuario.nome.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 24, margin: 0, color: COLORS.primaryDark }}>{usuario.nome}</h1>
            <Badge tone={usuario.perfil === "administrador" ? "accent" : "neutral"}>{usuario.perfil}</Badge>
            {!ativo && <Badge tone="danger">Inativo</Badge>}
          </div>
          <p style={{ margin: "0 0 2px", fontSize: 13, color: COLORS.neutral }}>CPF: {usuario.cpf}</p>
          {usuario.email && <p style={{ margin: "0 0 2px", fontSize: 13, color: COLORS.neutral }}>{usuario.email}</p>}
          {usuario.telefone && <p style={{ margin: 0, fontSize: 13, color: COLORS.neutral }}>{usuario.telefone}</p>}
        </div>
        <div style={{ textAlign: "center", padding: "12px 20px", background: COLORS.bgAlt, borderRadius: 12 }}>
          <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 32, fontWeight: 700, color: COLORS.primaryDark, lineHeight: 1 }}>{historico.length}</div>
          <div style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>empréstimo(s)</div>
        </div>
      </div>

      <Section title="Linha do tempo de empréstimos">
        {historico.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.neutral }}>Nenhum empréstimo registrado para este usuário.</p>
        ) : (
          <div style={{ position: "relative", paddingLeft: 28 }}>
            <div style={{ position: "absolute", left: 9, top: 10, bottom: 10, width: 2, background: COLORS.border }} />
            {historico.map((e, i) => {
              const tituloEmp = getTituloFromEmprestimo(e, exemplares, titulos);
              const cor = corDot(e.status);
              return (
                <div key={e.id} style={{ position: "relative", marginBottom: i < historico.length - 1 ? 20 : 0 }}>
                  <div style={{
                    position: "absolute", left: -28, top: 14,
                    width: 14, height: 14, borderRadius: "50%",
                    background: cor, border: "2px solid #fff",
                    boxShadow: `0 0 0 2px ${cor}44`, zIndex: 1,
                  }} />
                  <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 15, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>
                          {tituloEmp?.titulo || "Livro removido"}
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.neutral }}>
                          Empréstimo: {fmtDate(e.dataEmprestimo)} · Prazo: {fmtDate(e.dataDevolucao)}
                        </div>
                        {e.dataDevolvido && (
                          <div style={{ fontSize: 12, color: COLORS.success, marginTop: 2 }}>
                            Devolvido em {fmtDateTime(e.dataDevolvido)} · por {e.devolvidoPor}
                          </div>
                        )}
                        {e.observacoes && (
                          <div style={{ fontSize: 12, fontStyle: "italic", color: COLORS.neutral, marginTop: 2 }}>{e.observacoes}</div>
                        )}
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function UsuarioEditForm({ usuario, onSave, onClose, isAdmin = false, usuariosExistentes = [] }) {
  const [cpf, setCpf] = useState(usuario.cpf || "");
  const [nome, setNome] = useState(usuario.nome || "");
  const [email, setEmail] = useState(usuario.email || "");
  const [telefone, setTelefone] = useState(usuario.telefone || "");
  const [perfil, setPerfil] = useState(usuario.perfil || "leitor");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!nome.trim()) { setErr("O nome é obrigatório."); return; }
    if (isAdmin) {
      const cpfLimpo = cpf.replace(/\D/g, "");
      if (!cpfLimpo || cpfLimpo.length !== 11) { setErr("CPF deve ter 11 dígitos."); return; }
      if (cpfLimpo !== usuario.cpf && usuariosExistentes.some((u) => u.cpf === cpfLimpo)) {
        setErr("Já existe outro usuário com este CPF.");
        return;
      }
    }
    const dados = { cpf: isAdmin ? cpf.replace(/\D/g, "") : usuario.cpf, nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), perfil };
    if (senha.trim()) dados.senha = senha.trim();
    onSave(dados);
  }

  return (
    <Modal title={`Editar: ${usuario.nome}`} onClose={onClose} width={480}>
      <form onSubmit={submit}>
        <Field
          label="CPF"
          required={isAdmin}
          hint={isAdmin ? "Atenção: alterar o CPF muda o identificador único do usuário." : undefined}
        >
          {isAdmin ? (
            <Input
              value={cpf}
              onChange={(e) => { setCpf(e.target.value); setErr(""); }}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          ) : (
            <div style={{ padding: "9px 12px", background: COLORS.bgAlt, borderRadius: 8, fontSize: 14, color: COLORS.neutral, border: `1px solid ${COLORS.border}` }}>
              {usuario.cpf}
            </div>
          )}
        </Field>
        <Field label="Nome" required>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Telefone">
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </Field>
        <Field label="Perfil">
          <Select value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            <option value="leitor">Leitor</option>
            <option value="administrador">Administrador</option>
          </Select>
        </Field>
        <Field label="Nova senha" hint="Deixe em branco para manter a senha atual.">
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" />
        </Field>
        {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <Btn type="submit" style={{ width: "100%", justifyContent: "center" }}>Salvar alterações</Btn>
      </form>
    </Modal>
  );
}

function NovoUsuarioForm({ usuariosExistentes, onSave, onClose }) {
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [perfil, setPerfil] = useState("leitor");
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (!cpfLimpo || cpfLimpo.length !== 11) { setErr("CPF deve ter 11 dígitos."); return; }
    if (usuariosExistentes.some((u) => u.cpf === cpfLimpo)) { setErr("Já existe um usuário com este CPF."); return; }
    if (!nome.trim()) { setErr("O nome é obrigatório."); return; }
    if (!email.trim() && !telefone.trim()) { setErr("Informe ao menos e-mail ou telefone para envio do convite."); return; }
    onSave({
      cpf: cpfLimpo,
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      perfil,
      senha: null,
      pendingSenha: true,
      tokenSenha: uid("tk"),
      ativo: true,
    });
  }

  return (
    <Modal title="Novo usuário" onClose={onClose} width={480}>
      <form onSubmit={submit}>
        <div style={{ padding: "10px 14px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, marginBottom: 18, fontSize: 13, color: "#1E40AF", lineHeight: 1.5 }}>
          O usuário receberá um convite por <strong>e-mail</strong> e <strong>WhatsApp/SMS</strong> com um link para definir a própria senha no primeiro acesso.
        </div>
        <Field label="CPF" required hint="11 dígitos — identificador único, não pode ser alterado depois.">
          <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" maxLength={14} />
        </Field>
        <Field label="Nome completo" required>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="E-mail" hint="Usado para envio do convite.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Telefone (WhatsApp/SMS)" hint="Usado para envio do convite.">
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="+55 (00) 00000-0000" />
        </Field>
        <Field label="Perfil">
          <Select value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            <option value="leitor">Leitor</option>
            <option value="administrador">Administrador</option>
          </Select>
        </Field>
        {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <Btn type="submit" style={{ width: "100%", justifyContent: "center" }}>Criar e enviar convite</Btn>
      </form>
    </Modal>
  );
}

/* =========================================================================
   SCREEN: MINHA BIBLIOTECA
   ========================================================================= */
function MinhaBibliotecaScreen({ ctx }) {
  const { auth, showToast } = ctx;
  const [tab, setTab] = useState("livros");
  const [livros, setLivros] = useState([]);
  const [emprestimos, setEmprestimos] = useState([]);
  const [booted, setBooted] = useState(false);
  const [formLivro, setFormLivro] = useState(null);
  const [formEmp, setFormEmp] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [toDevolver, setToDevolver] = useState(null);
  const [query, setQuery] = useState("");

  const kLivros = `minhabiblioteca:livros:${auth.cpf}`;
  const kEmp = `minhabiblioteca:emprestimos:${auth.cpf}`;

  useEffect(() => {
    Promise.all([loadKey(kLivros, []), loadKey(kEmp, [])]).then(([l, e]) => {
      setLivros(Array.isArray(l) ? l : []);
      setEmprestimos(Array.isArray(e) ? e : []);
      setBooted(true);
    });
  }, []);

  useEffect(() => { if (booted) saveKey(kLivros, livros); }, [livros, booted]);
  useEffect(() => { if (booted) saveKey(kEmp, emprestimos); }, [emprestimos, booted]);

  useEffect(() => {
    if (!booted) return;
    const today = todayISO();
    setEmprestimos((prev) => prev.map((e) =>
      e.status === "Ativo" && e.dataDevolucao < today ? { ...e, status: "Atrasado" } : e
    ));
  }, [booted]);

  function salvarLivro(dados) {
    if (formLivro?.id) {
      setLivros((prev) => prev.map((l) => l.id === formLivro.id ? { ...l, ...dados } : l));
      showToast("Livro atualizado.");
    } else {
      setLivros((prev) => [...prev, { ...dados, id: uid("PL"), status: "Disponível" }]);
      showToast("Livro adicionado à sua biblioteca.");
    }
    setFormLivro(null);
  }

  function excluirLivro(l) {
    if (emprestimos.some((e) => e.livroId === l.id && e.status !== "Devolvido")) {
      showToast("Não é possível excluir: livro tem empréstimo ativo."); return;
    }
    setLivros((prev) => prev.filter((x) => x.id !== l.id));
    setToDelete(null);
    showToast("Livro removido.");
  }

  function salvarEmprestimo(dados) {
    setEmprestimos((prev) => [...prev, { ...dados, id: uid("PE"), status: "Ativo" }]);
    setLivros((prev) => prev.map((l) => l.id === dados.livroId ? { ...l, status: "Emprestado" } : l));
    showToast(`Empréstimo registrado para ${dados.amigo}.`);
    setFormEmp(null);
  }

  function devolver(e) {
    setEmprestimos((prev) => prev.map((x) => x.id === e.id ? { ...x, status: "Devolvido", dataDevolvido: todayISO() } : x));
    setLivros((prev) => prev.map((l) => l.id === e.livroId ? { ...l, status: "Disponível" } : l));
    setToDevolver(null);
    showToast("Devolução registrada.");
  }

  const livrosFiltrados = livros.filter((l) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return l.titulo.toLowerCase().includes(q) || (l.autor || "").toLowerCase().includes(q);
  });
  const livrosDisponiveis = livros.filter((l) => l.status === "Disponível");
  const empAtivos = emprestimos.filter((e) => e.status !== "Devolvido").length;
  const empAtrasados = emprestimos.filter((e) => e.status === "Atrasado").length;

  return (
    <div>
      <PageTitle
        title="Minha Biblioteca"
        subtitle={`${livros.length} ${livros.length === 1 ? "livro" : "livros"} no seu acervo pessoal`}
      />

      <div style={{ display: "inline-flex", border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
        {[
          { key: "livros", label: "Meus Livros" },
          { key: "emprestimos", label: `Empréstimos${empAtivos > 0 ? ` (${empAtivos})` : ""}` },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: tab === t.key ? COLORS.primary : "#fff",
            color: tab === t.key ? "#fff" : COLORS.neutral,
            fontFamily: "Inter, sans-serif",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── ABA: LIVROS ─────────────────────────────────────────────────── */}
      {tab === "livros" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <SearchBar value={query} onChange={setQuery} placeholder="Buscar por título ou autor…" />
            <Btn icon={Plus} onClick={() => setFormLivro({})}>Adicionar</Btn>
          </div>

          {empAtrasados > 0 && (
            <div style={{ marginBottom: 16, background: COLORS.dangerBg, border: `1px solid ${COLORS.danger}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: COLORS.danger, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} />
              {empAtrasados} empréstimo(s) pessoal(is) em atraso.
              <button onClick={() => setTab("emprestimos")} style={{ background: "none", border: "none", color: COLORS.danger, fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontFamily: "Inter, sans-serif", fontSize: 13 }}>Ver</button>
            </div>
          )}

          {livrosFiltrados.length === 0 ? (
            <EmptyState icon={Bookmark} text={query ? "Nenhum livro encontrado." : "Sua biblioteca pessoal está vazia. Adicione o primeiro livro!"} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
              {livrosFiltrados.map((l) => {
                const empAtivo = emprestimos.find((e) => e.livroId === l.id && e.status !== "Devolvido");
                return (
                  <div key={l.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ height: 100, background: COLORS.bgAlt, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {l.foto
                        ? <img src={l.foto} alt={l.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <BookOpen size={32} color={COLORS.neutralLight} />}
                      <div style={{ position: "absolute", top: 8, right: 8 }}>
                        <StatusBadge status={l.status} />
                      </div>
                    </div>
                    <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, lineHeight: 1.3 }}>{l.titulo}</div>
                      <div style={{ fontSize: 12, color: COLORS.neutral }}>{l.autor}</div>
                      {empAtivo && <div style={{ fontSize: 11, color: COLORS.warn, marginTop: 2 }}>→ {empAtivo.amigo}</div>}
                    </div>
                    <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "8px 12px", display: "flex", gap: 0 }}>
                      <button onClick={() => setFormLivro(l)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: COLORS.primary, fontFamily: "Inter, sans-serif", fontWeight: 500, padding: "4px 0" }}>Editar</button>
                      {l.status === "Disponível" && (
                        <button onClick={() => setFormEmp({ livroId: l.id })} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: COLORS.accent, fontFamily: "Inter, sans-serif", fontWeight: 500, padding: "4px 0" }}>Emprestar</button>
                      )}
                      <button onClick={() => setToDelete(l)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: COLORS.danger, fontFamily: "Inter, sans-serif", fontWeight: 500, padding: "4px 0" }}>Excluir</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA: EMPRÉSTIMOS ────────────────────────────────────────────── */}
      {tab === "emprestimos" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: COLORS.neutral }}>
              {emprestimos.length === 0 ? "Nenhum empréstimo registrado." : `${emprestimos.length} empréstimo(s) no histórico`}
            </div>
            <Btn icon={Plus} onClick={() => setFormEmp({})} disabled={livrosDisponiveis.length === 0}>Novo</Btn>
          </div>

          {livrosDisponiveis.length === 0 && livros.length > 0 && (
            <div style={{ marginBottom: 16, background: COLORS.warnBg, border: `1px solid ${COLORS.warn}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: COLORS.warn }}>
              Todos os seus livros estão emprestados no momento.
            </div>
          )}

          {emprestimos.length === 0 ? (
            <EmptyState icon={RefreshCw} text="Nenhum empréstimo pessoal registrado ainda." />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {[...emprestimos]
                .sort((a, b) => {
                  const ord = { Atrasado: 0, Ativo: 1, Devolvido: 2 };
                  return (ord[a.status] ?? 3) - (ord[b.status] ?? 3) || b.dataEmprestimo.localeCompare(a.dataEmprestimo);
                })
                .map((e) => {
                  const livro = livros.find((l) => l.id === e.livroId);
                  const atrasadoDias = e.status === "Atrasado" ? diffDays(e.dataDevolucao, todayISO()) : 0;
                  return (
                    <div key={e.id} style={{
                      background: "#fff",
                      border: `1px solid ${e.status === "Atrasado" ? COLORS.danger + "55" : COLORS.border}`,
                      borderLeft: `3px solid ${e.status === "Atrasado" ? COLORS.danger : e.status === "Devolvido" ? COLORS.success : COLORS.neutralLight}`,
                      borderRadius: 12, padding: "14px 16px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 15, fontWeight: 600, color: COLORS.ink, marginBottom: 2 }}>
                            {livro?.titulo || "Livro removido"}
                          </div>
                          <div style={{ fontSize: 13, color: COLORS.neutral }}>
                            <strong style={{ color: COLORS.ink }}>{e.amigo}</strong> · {fmtDate(e.dataEmprestimo)} → {fmtDate(e.dataDevolucao)}
                          </div>
                          {e.status === "Atrasado" && (
                            <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>Atrasado há {atrasadoDias} {atrasadoDias === 1 ? "dia" : "dias"}</div>
                          )}
                          {e.status === "Devolvido" && e.dataDevolvido && (
                            <div style={{ fontSize: 12, color: COLORS.success, marginTop: 4 }}>Devolvido em {fmtDate(e.dataDevolvido)}</div>
                          )}
                          {e.observacoes && (
                            <div style={{ fontSize: 12, color: COLORS.neutral, fontStyle: "italic", marginTop: 4 }}>{e.observacoes}</div>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                          <StatusBadge status={e.status} />
                          {e.status !== "Devolvido" && (
                            <button onClick={() => setToDevolver(e)} style={{
                              background: COLORS.successBg, border: `1px solid ${COLORS.success}44`,
                              borderRadius: 6, padding: "5px 10px", fontSize: 12, color: COLORS.success,
                              cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 600,
                            }}>
                              Devolvido ✓
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {formLivro !== null && (
        <MeuLivroForm livro={formLivro?.id ? formLivro : null} onSave={salvarLivro} onClose={() => setFormLivro(null)} />
      )}
      {formEmp !== null && (
        <MeuEmprestimoForm livroIdInicial={formEmp?.livroId || null} livrosDisponiveis={livrosDisponiveis} onSave={salvarEmprestimo} onClose={() => setFormEmp(null)} />
      )}
      {toDelete && (
        <Confirm text={`Excluir "${toDelete.titulo}" da sua biblioteca pessoal?`} onConfirm={() => excluirLivro(toDelete)} onCancel={() => setToDelete(null)} />
      )}
      {toDevolver && (
        <Confirm
          text={`Confirmar devolução de "${livros.find((l) => l.id === toDevolver.livroId)?.titulo}" por ${toDevolver.amigo}?`}
          onConfirm={() => devolver(toDevolver)}
          onCancel={() => setToDevolver(null)}
        />
      )}
    </div>
  );
}

function MeuLivroForm({ livro, onSave, onClose }) {
  const [titulo, setTitulo] = useState(livro?.titulo || "");
  const [autor, setAutor] = useState(livro?.autor || "");
  const [isbn, setIsbn] = useState(livro?.isbn || "");
  const [ano, setAno] = useState(livro?.ano || "");
  const [editora, setEditora] = useState(livro?.editora || "");
  const [conservacao, setConservacao] = useState(livro?.conservacao || "Bom");
  const [foto, setFoto] = useState(livro?.foto || null);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  function handleFoto(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => setFoto(e.target.result);
    r.readAsDataURL(f);
  }

  function submit(ev) {
    ev.preventDefault();
    if (!titulo.trim()) { setErr("O título é obrigatório."); return; }
    if (!autor.trim()) { setErr("O autor é obrigatório."); return; }
    onSave({ titulo: titulo.trim(), autor: autor.trim(), isbn: isbn.trim(), ano: ano.trim(), editora: editora.trim(), conservacao, foto });
  }

  return (
    <Modal title={livro ? "Editar livro" : "Adicionar livro"} onClose={onClose} width={480}>
      <form onSubmit={submit}>
        <Field label="Título" required>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Field>
        <Field label="Autor" required>
          <Input value={autor} onChange={(e) => setAutor(e.target.value)} />
        </Field>
        <Field label="ISBN">
          <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978-…" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Ano">
            <Input value={ano} onChange={(e) => setAno(e.target.value)} placeholder="2024" maxLength={4} />
          </Field>
          <Field label="Conservação">
            <Select value={conservacao} onChange={(e) => setConservacao(e.target.value)}>
              {["Ótimo", "Bom", "Regular", "Ruim"].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Editora">
          <Input value={editora} onChange={(e) => setEditora(e.target.value)} />
        </Field>
        <Field label="Capa (opcional)">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {foto && <img src={foto} alt="capa" style={{ width: 44, height: 60, objectFit: "cover", borderRadius: 6, border: `1px solid ${COLORS.border}` }} />}
            <Btn type="button" variant="ghost" icon={Camera} onClick={() => fileRef.current?.click()}>
              {foto ? "Trocar" : "Escolher imagem"}
            </Btn>
            {foto && <button type="button" onClick={() => setFoto(null)} style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", fontSize: 12, fontFamily: "Inter, sans-serif" }}>Remover</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFoto} />
        </Field>
        {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <Btn type="submit" style={{ width: "100%", justifyContent: "center" }}>
          {livro ? "Salvar alterações" : "Adicionar à minha biblioteca"}
        </Btn>
      </form>
    </Modal>
  );
}

function MeuEmprestimoForm({ livroIdInicial, livrosDisponiveis, onSave, onClose }) {
  const [livroId, setLivroId] = useState(livroIdInicial || livrosDisponiveis[0]?.id || "");
  const [amigo, setAmigo] = useState("");
  const [dataEmprestimo, setDataEmprestimo] = useState(todayISO());
  const [dataDevolucao, setDataDevolucao] = useState(addDays(todayISO(), 14));
  const [observacoes, setObservacoes] = useState("");
  const [err, setErr] = useState("");

  function submit(ev) {
    ev.preventDefault();
    if (!livroId) { setErr("Selecione um livro."); return; }
    if (!amigo.trim()) { setErr("Informe o nome do amigo ou familiar."); return; }
    if (dataDevolucao <= dataEmprestimo) { setErr("A data de devolução deve ser posterior à data do empréstimo."); return; }
    onSave({ livroId, amigo: amigo.trim(), dataEmprestimo, dataDevolucao, observacoes: observacoes.trim() });
  }

  return (
    <Modal title="Registrar empréstimo pessoal" onClose={onClose} width={480}>
      <form onSubmit={submit}>
        <div style={{ padding: "10px 14px", background: COLORS.bgAlt, borderRadius: 10, marginBottom: 16, fontSize: 13, color: COLORS.neutral }}>
          Empréstimos pessoais não enviam notificações — são registros só para você.
        </div>
        <Field label="Livro" required>
          <Select value={livroId} onChange={(e) => setLivroId(e.target.value)}>
            {livrosDisponiveis.map((l) => <option key={l.id} value={l.id}>{l.titulo}</option>)}
          </Select>
        </Field>
        <Field label="Emprestado para" required hint="Nome do amigo ou familiar.">
          <Input value={amigo} onChange={(e) => setAmigo(e.target.value)} placeholder="Ex: João Silva" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Data do empréstimo" required>
            <Input type="date" value={dataEmprestimo} onChange={(e) => setDataEmprestimo(e.target.value)} />
          </Field>
          <Field label="Prazo de devolução" required>
            <Input type="date" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} />
          </Field>
        </div>
        <Field label="Observações">
          <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional…" />
        </Field>
        {err && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <Btn type="submit" style={{ width: "100%", justifyContent: "center" }}>Registrar empréstimo</Btn>
      </form>
    </Modal>
  );
}
