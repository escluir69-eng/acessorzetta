import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "@/lib/searchParams";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  History,
  Plus,
  Radio,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BankAvatar } from "@/components/BankAvatar";
import { AppShell } from "@/components/layout/AppShell";
import { PluggySettings } from "@/components/PluggySettings";
import { useOrion } from "@/store/orionContext";
import { formatBRL, formatDateBR, parseBRL } from "@/lib/domain/money";
import { db, doc, getDoc, updateDoc, deleteDoc } from "@/lib/firebase";
import type { CardBrand, CreditCardAccount } from "@/types/orion";

function getCardDesign(card: CreditCardAccount) {
  const text = `${card.institution} ${card.name}`.toLowerCase();
  if (/nubank|\bnu\b/.test(text)) {
    return { gradient: "linear-gradient(125deg,#5a0f70,#9b1db5 70%,#72118c)", label: "nu" };
  }
  if (/ita[uú]/.test(text)) {
    return { gradient: "linear-gradient(135deg,#0c1928,#22374f 70%,#ec7000)", label: "itaú" };
  }
  if (/btg/.test(text)) {
    return { gradient: "linear-gradient(135deg,#1d2b3a,#3b5169)", label: "btg pactual" };
  }
  return { gradient: "linear-gradient(135deg,#173d4a,#0c1928)", label: card.institution };
}

function formatCapturedAtBR(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CarteiraPage() {
  const { state, user, addBankAccount, addCreditCard } = useOrion();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<(typeof state.transactions)[number] | null>(null);
  const [selectedSnapshotTransaction, setSelectedSnapshotTransaction] = useState<{ description: string; date: string; amount: number; category?: string } | null>(null);
  const [bankMenuId, setBankMenuId] = useState<string | null>(null);
  const [bankEditingId, setBankEditingId] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [showHiddenBanks, setShowHiddenBanks] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [txSearch, setTxSearch] = useState(() => searchParams.get("q") ?? "");
  const [expandedSnapIds, setExpandedSnapIds] = useState<Record<string, boolean>>({});
  const [snapshotMenuId, setSnapshotMenuId] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<(typeof state.cardMonthSnapshots)[number] | null>(null);
  const [snapshotForm, setSnapshotForm] = useState({ accountId: "", period: "", capturedAt: "", closingDate: "", dueDate: "", invoice: "", totalLimit: "", usedLimit: "", availableLimit: "" });
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setTxSearch(q);
  }, [searchParams]);

  // Add account modal
  const [bankOpen, setBankOpen] = useState(false);
  const [bankInst, setBankInst] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankNum, setBankNum] = useState("");
  const [bankBal, setBankBal] = useState("");

  // Add card modal
  const [cardOpen, setCardOpen] = useState(false);
  const [cardInst, setCardInst] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardBrand, setCardBrand] = useState<CardBrand>("MASTERCARD");
  const [cardNum, setCardNum] = useState("");
  const [cardLimit, setCardLimit] = useState("");

  const activeCard = state.cards[selectedCardIdx] ?? state.cards[0];

  const sortedSnapshots = useMemo(() => {
    return [...state.cardMonthSnapshots].sort((a, b) => {
      const periodCmp = b.period.localeCompare(a.period);
      if (periodCmp !== 0) return periodCmp;
      return b.capturedAt.localeCompare(a.capturedAt);
    });
  }, [state.cardMonthSnapshots]);

  const cardLookup = useMemo(() => {
    const map = new Map<string, CreditCardAccount>();
    for (const card of state.cards) {
      map.set(card.id, card);
      if (card.sourceRecordId) map.set(card.sourceRecordId, card);
    }
    return map;
  }, [state.cards]);

  const filteredTx = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return state.transactions.filter((t) => {
      if (!q) return true;
      return `${t.description} ${t.accountName} ${t.institution} ${t.category} ${t.date}`
        .toLowerCase()
        .includes(q);
    });
  }, [state.transactions, txSearch]);

  function toggleSnapshot(id: string) {
    setExpandedSnapIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function openSnapshotEditor(snap: (typeof state.cardMonthSnapshots)[number]) {
    setSnapshotMenuId(null);
    setEditingSnapshot(snap);
    setSnapshotForm({
      accountId: cardLookup.get(snap.accountId)?.id ?? "", period: snap.period,
      capturedAt: snap.capturedAt ? new Date(snap.capturedAt).toISOString().slice(0, 16) : "",
      closingDate: snap.closingDate ?? "", dueDate: snap.dueDate ?? "",
      invoice: snap.invoiceCents === null ? "" : (snap.invoiceCents / 100).toFixed(2).replace(".", ","),
      totalLimit: snap.totalLimitCents === null ? "" : (snap.totalLimitCents / 100).toFixed(2).replace(".", ","),
      usedLimit: snap.usedLimitCents === null ? "" : (snap.usedLimitCents / 100).toFixed(2).replace(".", ","),
      availableLimit: snap.availableLimitCents === null ? "" : (snap.availableLimitCents / 100).toFixed(2).replace(".", ","),
    });
  }

  async function saveSnapshotEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSnapshot || !user?.uid || savingSnapshot) return;
    if (!/^\\d{4}-(0[1-9]|1[0-2])$/.test(snapshotForm.period) || !snapshotForm.capturedAt) {
      toast.error("Informe uma competência e data de captura válidas."); return;
    }
    const cents = (value: string) => value.trim() ? parseBRL(value) : null;
    const invoice = cents(snapshotForm.invoice), totalLimit = cents(snapshotForm.totalLimit);
    const usedLimit = cents(snapshotForm.usedLimit), availableLimit = cents(snapshotForm.availableLimit);
    if ([invoice, totalLimit, usedLimit, availableLimit].some((v) => v !== null && (!Number.isSafeInteger(v) || v < 0))) {
      toast.error("Informe valores monetários válidos e não negativos."); return;
    }
    const linked = state.cards.find((card) => card.id === snapshotForm.accountId);
    setSavingSnapshot(true);
    try {
      const ref = doc(db, "users", user.uid, "cardMonthSnapshots", editingSnapshot.id);
      const current = await getDoc(ref);
      if (!current.exists()) throw new Error("Este retrato não existe mais.");
      await updateDoc(ref, {
        accountId: linked?.id ?? editingSnapshot.accountId,
        ...(linked ? { accountName: linked.institution + " · " + linked.name, isUnlinked: false } : { isUnlinked: true }),
        period: snapshotForm.period, capturedAt: new Date(snapshotForm.capturedAt).toISOString(),
        closingDate: snapshotForm.closingDate || null, dueDate: snapshotForm.dueDate || null,
        invoiceCents: invoice, totalLimitCents: totalLimit, usedLimitCents: usedLimit,
        availableLimitCents: availableLimit, updatedAt: new Date().toISOString(),
      });
      setEditingSnapshot(null); toast.success("Retrato mensal atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o retrato.");
    } finally { setSavingSnapshot(false); }
  }

  async function deleteSnapshot(snap: (typeof state.cardMonthSnapshots)[number]) {
    setSnapshotMenuId(null);
    if (!user?.uid) { toast.error("Entre na sua conta para excluir este retrato."); return; }
    if (snap.transactions.length > 0) {
      toast.error("Este retrato contém lançamentos. Remova ou desvincule-os por um fluxo próprio antes de excluir."); return;
    }
    if (!window.confirm("Excluir somente este retrato histórico? O cartão cadastrado não será alterado.")) return;
    try {
      const ref = doc(db, "users", user.uid, "cardMonthSnapshots", snap.id);
      const current = await getDoc(ref);
      if (!current.exists()) throw new Error("Este retrato já foi removido.");
      const data = current.data();
      if (Array.isArray(data["transactions"]) && data["transactions"].length > 0) throw new Error("O retrato recebeu lançamentos e não pode ser excluído.");
      await deleteDoc(ref); toast.success("Retrato histórico excluído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o retrato.");
    }
  }


  function submitBank(e: React.FormEvent) {
    e.preventDefault();
    const bal = parseBRL(bankBal) ?? 0;
    if (!bankInst.trim() || !bankName.trim()) {
      toast.error("Informe instituição e nome da conta.");
      return;
    }
    if (bankEditingId && user?.uid) {
      void updateDoc(doc(db, "users", user.uid, "banks", bankEditingId), { institution: bankInst.trim(), name: bankName.trim(), number: bankNum.trim() || "0001", balanceCents: bal, updatedAt: new Date().toISOString() }).then(() => toast.success("Conta atualizada.")).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a conta."));
    } else {
      void addBankAccount({ institution: bankInst.trim(), name: bankName.trim(), accountType: "CHECKING", number: bankNum.trim() || "0001", balanceCents: bal, color: "#173d4a" });
      toast.success("Conta adicionada à carteira.");
    }
    setBankEditingId(null);
    setBankOpen(false);
    setBankInst("");
    setBankName("");
    setBankNum("");
    setBankBal("");
  }

  function openBankEditor(bank: (typeof state.banks)[number]) {
    setBankMenuId(null); setBankEditingId(bank.id); setBankInst(bank.institution); setBankName(bank.name); setBankNum(bank.number); setBankBal((bank.balanceCents / 100).toFixed(2).replace(".", ",")); setBankOpen(true);
  }

  async function toggleBankHidden(bank: (typeof state.banks)[number]) {
    if (!user?.uid) return;
    try { await updateDoc(doc(db, "users", user.uid, "banks", bank.id), { isHidden: !bank.isHidden, updatedAt: new Date().toISOString() }); setBankMenuId(null); toast.success(bank.isHidden ? "Conta exibida novamente." : "Conta ocultada."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar a visibilidade."); }
  }

  async function removeBank(bank: (typeof state.banks)[number]) {
    if (!user?.uid) return;
    if (state.transactions.some((tx) => tx.accountId === bank.id) || bank.sourceRecordId) { toast.error("Esta conta possui histórico ou vínculo externo. Oculte-a para preservar a conciliação."); return; }
    if (!window.confirm(`Excluir a conta ${bank.name}?`)) return;
    try { await deleteDoc(doc(db, "users", user.uid, "banks", bank.id)); setBankMenuId(null); toast.success("Conta excluída."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir a conta."); }
  }

  function submitCard(e: React.FormEvent) {
    e.preventDefault();
    const lim = parseBRL(cardLimit);
    if (!cardInst.trim() || !cardName.trim() || !lim || lim <= 0) {
      toast.error("Informe instituição, nome do cartão e limite válido.");
      return;
    }
    addCreditCard({
      institution: cardInst.trim(),
      name: cardName.trim(),
      brand: cardBrand,
      number: cardNum.trim() || "0000",
      creditLimitCents: lim,
      availableCents: lim,
      closingDay: 15,
      dueDay: 25,
    });
    setCardOpen(false);
    setCardInst("");
    setCardName("");
    setCardNum("");
    setCardLimit("");
    toast.success("Cartão adicionado à carteira.");
  }

  return (
    <AppShell
      title="Carteira"
      subtitle="Contas bancárias, cartões de crédito e movimentações consolidadas"
      actions={
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <PluggySettings />
          <button
            type="button"
            onClick={() => setBankOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce2e6] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#f0f3f5] whitespace-nowrap"
          >
            <Plus className="size-3.5" /> Conta
          </button>
          <button
            type="button"
            onClick={() => setCardOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#173d4a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0c1928] whitespace-nowrap"
          >
            <Plus className="size-3.5" /> Cartão
          </button>
        </div>
      }
    >
      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Bank Accounts */}
        <section className="min-w-0 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-[#0c1928]">Contas Bancárias</h2>
          <div className="mt-3 flex justify-end"><button type="button" onClick={() => setShowHiddenBanks((v) => !v)} className="text-xs font-semibold text-[#52616a]">{showHiddenBanks ? "Ocultar contas ocultas" : "Mostrar contas ocultas"}</button></div>
          <div className="mt-3 divide-y divide-[#edf1f3]">
            {state.banks.filter((bank) => showHiddenBanks || !bank.isHidden).length === 0 ? (
              <p className="py-8 text-center text-sm text-[#52616a]">
                Nenhuma conta cadastrada. Clique em &quot;+ Conta&quot; para adicionar.
              </p>
            ) : (
              state.banks.filter((bank) => showHiddenBanks || !bank.isHidden).map((b) => (
                <div key={b.id} className={`flex items-center justify-between gap-2 py-3 ${b.isHidden ? "opacity-50" : ""}`}>
                  <button type="button" onClick={() => setSelectedBankId(b.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80"><BankAvatar institution={b.institution} /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#0c1928]">{b.name}</span><span className="block truncate text-xs text-[#52616a]">{b.institution} · •••• {b.number}</span></span></button>
                  <div className="tabular-nums shrink-0 text-sm font-bold text-[#173d4a]">{formatBRL(b.balanceCents)}</div>
                  <div className="relative"><button type="button" aria-label={`Ações de ${b.name}`} onClick={() => setBankMenuId((id) => id === b.id ? null : b.id)} className="grid size-8 place-items-center rounded-lg border border-[#dce2e6] text-[#52616a]"><MoreVertical className="size-4" /></button>{bankMenuId === b.id && <div role="menu" className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-[#dce2e6] bg-white py-1 shadow-lg"><button type="button" role="menuitem" onClick={() => openBankEditor(b)} className="block w-full px-3 py-2 text-left text-xs hover:bg-[#f0f3f5]">Editar conta</button><button type="button" role="menuitem" onClick={() => void toggleBankHidden(b)} className="block w-full px-3 py-2 text-left text-xs hover:bg-[#f0f3f5]">{b.isHidden ? "Mostrar conta" : "Ocultar conta"}</button><button type="button" role="menuitem" onClick={() => void removeBank(b)} className="block w-full px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50">Excluir conta</button></div>}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Interactive Card Wallet */}
        <section className="min-w-0 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-[#0c1928]">Cartões Cadastrados</h2>
          {activeCard ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={state.cards.length < 2}
                  onClick={() =>
                    setSelectedCardIdx(
                      (selectedCardIdx - 1 + state.cards.length) % state.cards.length,
                    )
                  }
                  aria-label="Cartão anterior"
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-[#dce2e6] hover:bg-[#f0f3f5] disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>

                <button type="button" onClick={() => setShowCardDetails(true)} aria-label={`Abrir detalhes do cartão ${activeCard.name}`} className="relative min-w-0 flex-1 overflow-hidden rounded-lg p-3 text-left text-brand-ice shadow-md"
                  style={{ background: getCardDesign(activeCard).gradient }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-80">
                        {activeCard.institution}
                      </div>
                      <div className="mt-0.5 text-lg font-bold">
                        {getCardDesign(activeCard).label}
                      </div>
                    </div>
                    <span className="text-xs font-extrabold tracking-wider">
                      {activeCard.brand}
                    </span>
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <div className="h-6 w-9 rounded border border-white/40 bg-white/25" />
                    <Radio className="size-4 rotate-90 opacity-80" />
                  </div>
                  <div className="mt-4 flex items-end justify-between text-xs">
                    <div>
                      <div className="font-semibold">{activeCard.name}</div>
                      <div className="opacity-80">•••• {activeCard.number}</div>
                    </div>
                    <div className="text-right opacity-90">
                      <div>Fecha dia {activeCard.closingDay}</div>
                      <div>Vence dia {activeCard.dueDay}</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={state.cards.length < 2}
                  onClick={() => setSelectedCardIdx((selectedCardIdx + 1) % state.cards.length)}
                  aria-label="Próximo cartão"
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-[#dce2e6] hover:bg-[#f0f3f5] disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-lg border border-[#edf1f3] bg-[#f7f8fa] p-2.5">
                  <div className="text-[#52616a]">Limite</div>
                  <div className="tabular-nums mt-1 font-bold text-[#0c1928]">
                    {formatBRL(activeCard.manualLimitCents ?? activeCard.creditLimitCents)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#edf1f3] bg-[#f7f8fa] p-2.5">
                  <div className="text-[#52616a]">Utilizado</div>
                  <div className="tabular-nums mt-1 font-bold text-[#dc2626]">
                    {formatBRL(
                      activeCard.manualUsedCents ??
                        Math.max(0, activeCard.creditLimitCents - activeCard.availableCents),
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-[#edf1f3] bg-[#f7f8fa] p-2.5">
                  <div className="text-[#52616a]">Disponível</div>
                  <div className="tabular-nums mt-1 font-bold text-[#16a34a]">
                    {formatBRL(
                      (activeCard.manualLimitCents ?? activeCard.creditLimitCents) -
                        (activeCard.manualUsedCents ??
                          Math.max(0, activeCard.creditLimitCents - activeCard.availableCents)),
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[#52616a]">Nenhum cartão cadastrado.</p>
          )}
        </section>

        {/* Transactions */}
        <section className="min-w-0 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#0c1928]">Movimentações</h2>
            <span className="text-[11px] text-[#52616a]">Entradas e saídas em uma única linha do tempo</span>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <input
              value={txSearch}
              onChange={(e) => {
                setTxSearch(e.target.value);
                if (searchParams.has("q")) {
                  searchParams.delete("q");
                  setSearchParams(searchParams, { replace: true });
                }
              }}
              placeholder="Filtrar transações por descrição, conta ou categoria..."
              className="h-8 min-w-0 flex-1 rounded-lg border border-[#cbd3d8] bg-white px-2.5 text-xs"
            />
            {txSearch && (
              <button
                type="button"
                onClick={() => {
                  setTxSearch("");
                  if (searchParams.has("q")) {
                    searchParams.delete("q");
                    setSearchParams(searchParams, { replace: true });
                  }
                }}
                className="h-8 rounded-lg border border-[#dce2e6] px-2 text-xs text-[#52616a] hover:bg-[#f0f3f5]"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="max-h-[420px] divide-y divide-[#edf1f3] overflow-y-auto pr-1">
            {filteredTx.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#52616a]">
                Nenhuma movimentação registrada ainda.
              </p>
            ) : (
              filteredTx.map((t) => {
                const income = t.amountCents >= 0;
                return (
                  <button type="button" key={t.id} onClick={() => setSelectedTransaction(t)} className="flex w-full items-start justify-between gap-3 py-2.5 text-left text-sm hover:bg-[#f7f8fa]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-[#0c1928]">{t.description}</div>
                      <div className="text-xs text-[#52616a]">
                        {t.accountName} · {formatDateBR(t.date)} · {t.category}
                      </div>
                    </div>
                    <div
                      className={`tabular-nums shrink-0 font-bold ${
                        income ? "text-[#16a34a]" : "text-[#dc2626]"
                      }`}
                    >
                      {income ? "+ " : "− "}
                      {formatBRL(Math.abs(t.amountCents))}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Histórico de capturas mensais, agrupado por competência */}
      <section className="mt-6 rounded-xl border border-[#dce2e6] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <History className="size-4 text-[#173d4a]" />
              <h2 className="text-lg font-semibold text-[#0c1928]">
                Retratos Mensais de Cartão (Histórico Pontual)
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#52616a]">
              Capturas históricas organizadas por ano e mês. Abra cada lançamento para conferir os detalhes; editar ou excluir um retrato não altera o limite atual do cartão nem quita faturas.
            </p>
          </div>
          <span className="rounded-full bg-[#f0f3f5] px-2.5 py-1 text-xs font-semibold text-[#173d4a]">
            {sortedSnapshots.length} retrato(s)
          </span>
        </div>

        {sortedSnapshots.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#52616a]">
            Nenhum retrato mensal de cartão importado até o momento.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedSnapshots.map((snap) => {
              const linkedCard = cardLookup.get(snap.accountId);
              const isUnlinked = Boolean(snap.isUnlinked || !linkedCard);
              const cardTitle = linkedCard
                ? `${linkedCard.institution} · ${linkedCard.name}`
                : snap.accountName || "Cartão não encontrado no cadastro";
              const expanded = Boolean(expandedSnapIds[snap.id]);

              return (
                <div
                  key={snap.id}
                  className="rounded-xl border border-[#dce2e6] bg-[#fafbfc] p-4 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-[#173d4a] px-2 py-0.5 text-xs font-bold text-white">
                          {snap.period}
                        </span>
                        <span className="text-sm font-semibold text-[#0c1928]">{cardTitle}</span>
                        {isUnlinked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            <AlertTriangle className="size-3" />
                            Sem vínculo
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#52616a]">
                        <span>Capturado em: {formatCapturedAtBR(snap.capturedAt)}</span>
                        {snap.closingDate && (
                          <span>Fechamento: {formatDateBR(snap.closingDate)}</span>
                        )}
                        {snap.dueDate && <span>Vencimento: {formatDateBR(snap.dueDate)}</span>}
                        {isUnlinked && snap.accountId && (
                          <span className="font-mono text-[11px]">
                            ID origem: {snap.accountId}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="relative">
                        <button type="button" onClick={() => setSnapshotMenuId((id) => id === snap.id ? null : snap.id)}
                          aria-label={"Ações do retrato " + snap.period + " — " + cardTitle} aria-haspopup="menu"
                          aria-expanded={snapshotMenuId === snap.id}
                          className="grid size-9 place-items-center rounded-lg border border-[#dce2e6] bg-white text-[#52616a] hover:bg-[#f0f3f5]">
                          <MoreVertical className="size-4" />
                        </button>
                        {snapshotMenuId === snap.id && <div role="menu" className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-[#dce2e6] bg-white py-1 shadow-lg">
                          <button type="button" role="menuitem" onClick={() => openSnapshotEditor(snap)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#0c1928] hover:bg-[#f0f3f5]"><Pencil className="size-3.5" /> Alterar retrato</button>
                          <button type="button" role="menuitem" onClick={() => void deleteSnapshot(snap)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"><Trash2 className="size-3.5" /> Excluir retrato</button>
                        </div>}
                      </div>
                      <button type="button" onClick={() => toggleSnapshot(snap.id)} aria-expanded={expanded}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce2e6] bg-white px-3 py-1.5 text-xs font-semibold text-[#173d4a] hover:bg-[#f0f3f5]">
                        {snap.transactions.length} lançamento(s)
                        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg border border-[#edf1f3] bg-white p-2.5">
                      <div className="text-[#52616a]">Fatura na captura</div>
                      <div className="tabular-nums mt-0.5 font-bold text-[#0c1928]">
                        {snap.invoiceCents !== null ? formatBRL(snap.invoiceCents) : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#edf1f3] bg-white p-2.5">
                      <div className="text-[#52616a]">Limite total (época)</div>
                      <div className="tabular-nums mt-0.5 font-bold text-[#0c1928]">
                        {snap.totalLimitCents !== null ? formatBRL(snap.totalLimitCents) : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#edf1f3] bg-white p-2.5">
                      <div className="text-[#52616a]">Utilizado (época)</div>
                      <div className="tabular-nums mt-0.5 font-bold text-[#dc2626]">
                        {snap.usedLimitCents !== null ? formatBRL(snap.usedLimitCents) : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#edf1f3] bg-white p-2.5">
                      <div className="text-[#52616a]">Disponível (época)</div>
                      <div className="tabular-nums mt-0.5 font-bold text-[#16a34a]">
                        {snap.availableLimitCents !== null
                          ? formatBRL(snap.availableLimitCents)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-3 rounded-lg border border-[#e5eaee] bg-white p-3">
                      {snap.transactions.length === 0 ? (
                        <p className="text-center text-xs text-[#52616a]">
                          Sem lançamentos detalhados neste retrato.
                        </p>
                      ) : (
                        <div className="max-h-64 divide-y divide-[#edf1f3] overflow-y-auto pr-1">
                          {snap.transactions.map((tx) => {
                            const amountCents = Math.round(tx.amount * 100);
                            const isCredit = amountCents < 0;
                            return (
                              <button type="button" key={tx.id} onClick={() => setSelectedSnapshotTransaction(tx)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-xs hover:bg-[#f7f8fa]"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium text-[#0c1928]">
                                    {tx.description}
                                  </div>
                                  <div className="text-[11px] text-[#52616a]">
                                    {tx.date ? formatDateBR(tx.date) : "—"}
                                    {tx.category ? ` · ${tx.category}` : ""}
                                  </div>
                                </div>
                                <div
                                  className={`tabular-nums shrink-0 font-semibold ${
                                    isCredit ? "text-[#16a34a]" : "text-[#0c1928]"
                                  }`}
                                >
                                  {isCredit ? "− " : ""}
                                  {formatBRL(Math.abs(amountCents))}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>


      {selectedBankId && (() => { const bank = state.banks.find((item) => item.id === selectedBankId); if (!bank) return null; const rows = state.transactions.filter((tx) => tx.accountId === bank.id || tx.accountId === bank.sourceRecordId); return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0c1928]/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedBankId(null); }}><section role="dialog" aria-modal="true" aria-label={`Movimentações de ${bank.name}`} className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#294158] bg-[#102033] p-5 text-white shadow-2xl"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">{bank.institution} · {bank.name}</h3><p className="text-xs text-slate-300">Saldo informado: {formatBRL(bank.balanceCents)}</p></div><button type="button" onClick={() => setSelectedBankId(null)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-white/10"><X className="size-4" /></button></div>{rows.length ? <div className="divide-y divide-white/10">{rows.map((tx) => <div key={tx.id} className="flex justify-between gap-3 py-3 text-sm"><div><div className="font-medium">{tx.description}</div><div className="text-xs text-slate-300">{formatDateBR(tx.date)} · {tx.category}</div></div><strong className={tx.amountCents >= 0 ? "text-emerald-400" : "text-red-400"}>{formatBRL(tx.amountCents)}</strong></div>)}</div> : <p className="py-10 text-center text-sm text-slate-300">Nenhuma movimentação encontrada para esta conta.</p>}</section></div>; })()}

      {showCardDetails && activeCard && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0c1928]/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCardDetails(false); }}><section role="dialog" aria-modal="true" aria-label={`Faturas e movimentações de ${activeCard.name}`} className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[#294158] bg-[#102033] p-5 text-white shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-semibold">{activeCard.institution} · {activeCard.name}</h3><p className="text-xs text-slate-300">Faturas históricas e movimentações sincronizadas</p></div><button type="button" onClick={() => setShowCardDetails(false)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-white/10"><X className="size-4" /></button></div><h4 className="mb-2 text-sm font-semibold">Faturas anteriores e atuais</h4>{sortedSnapshots.filter((snap) => snap.accountId === activeCard.id || snap.accountId === activeCard.sourceRecordId).length ? <div className="space-y-2">{sortedSnapshots.filter((snap) => snap.accountId === activeCard.id || snap.accountId === activeCard.sourceRecordId).map((snap) => <div key={snap.id} className="rounded-lg border border-white/10 p-3"><div className="flex justify-between gap-3"><strong>{snap.period}</strong><strong>{snap.invoiceCents === null ? "—" : formatBRL(snap.invoiceCents)}</strong></div><p className="mt-1 text-xs text-slate-300">Fechamento {snap.closingDate ? formatDateBR(snap.closingDate) : "—"} · Vencimento {snap.dueDate ? formatDateBR(snap.dueDate) : "—"}</p></div>)}</div> : <p className="rounded-lg border border-white/10 p-4 text-sm text-slate-300">Nenhuma fatura histórica sincronizada para este cartão.</p>}<h4 className="mb-2 mt-5 text-sm font-semibold">Provisões futuras</h4><p className="rounded-lg border border-dashed border-white/20 p-4 text-sm text-slate-300">As provisões futuras por parcela ainda não estão disponíveis nos dados recebidos da Pluggy. Nenhuma parcela será estimada ou lançada em duplicidade.</p><h4 className="mb-2 mt-5 text-sm font-semibold">Movimentações do cartão</h4>{state.transactions.filter((tx) => tx.accountId === activeCard.id || tx.accountId === activeCard.sourceRecordId).map((tx) => <div key={tx.id} className="flex justify-between gap-3 border-t border-white/10 py-2 text-sm"><span>{tx.description}<small className="block text-xs text-slate-300">{formatDateBR(tx.date)}</small></span><strong>{formatBRL(tx.amountCents)}</strong></div>)}</section></div>}

      {selectedTransaction && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0c1928]/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedTransaction(null); }}><section role="dialog" aria-modal="true" aria-label="Detalhes da movimentação" className="w-full max-w-lg rounded-xl border border-[#294158] bg-[#102033] p-5 text-white shadow-2xl"><div className="mb-4 flex justify-between"><h3 className="text-lg font-semibold">Detalhes da movimentação</h3><button type="button" onClick={() => setSelectedTransaction(null)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-white/10"><X className="size-4" /></button></div><p className="font-semibold">{selectedTransaction.description}</p><p className="mt-1 text-xs text-slate-300">{formatDateBR(selectedTransaction.date)} · {selectedTransaction.category}</p><p className="mt-4 text-2xl font-bold">{formatBRL(selectedTransaction.amountCents)}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-400">Origem / conta</dt><dd>{selectedTransaction.institution} · {selectedTransaction.accountName}</dd></div><div><dt className="text-slate-400">Tipo de conta</dt><dd>{selectedTransaction.accountType === "CREDIT" ? "Cartão de crédito" : "Conta bancária"}</dd></div><div><dt className="text-slate-400">Identificação</dt><dd>{selectedTransaction.reconciledEventId || "Movimentação importada"}</dd></div></dl></section></div>}

      {selectedSnapshotTransaction && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0c1928]/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedSnapshotTransaction(null); }}><section role="dialog" aria-modal="true" aria-label="Detalhes do lançamento do retrato" className="w-full max-w-lg rounded-xl border border-[#294158] bg-[#102033] p-5 text-white shadow-2xl"><div className="mb-4 flex justify-between"><h3 className="text-lg font-semibold">Lançamento do retrato</h3><button type="button" onClick={() => setSelectedSnapshotTransaction(null)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-white/10"><X className="size-4" /></button></div><p className="font-semibold">{selectedSnapshotTransaction.description}</p><p className="mt-1 text-xs text-slate-300">{selectedSnapshotTransaction.date ? formatDateBR(selectedSnapshotTransaction.date) : "Data não informada"} · {selectedSnapshotTransaction.category || "Sem categoria"}</p><p className="mt-4 text-2xl font-bold">{formatBRL(Math.round(selectedSnapshotTransaction.amount * 100))}</p></section></div>}

      {editingSnapshot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0c1928]/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingSnapshot(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="snapshot-edit-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#294158] bg-[#102033] p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3"><h3 id="snapshot-edit-title" className="text-base font-semibold">Alterar retrato mensal</h3>
              <button type="button" aria-label="Fechar edição" onClick={() => setEditingSnapshot(null)} className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10"><X className="size-4" /></button></div>
            <form onSubmit={saveSnapshotEdit} className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Cartão vinculado<select value={snapshotForm.accountId} onChange={(e) => setSnapshotForm((p) => ({ ...p, accountId: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-600 bg-[#0b1928] px-3 text-sm text-white">
                <option value="">Manter sem vínculo</option>{state.cards.map((card) => <option key={card.id} value={card.id}>{card.institution} · {card.name}</option>)}</select></label>
              <label className="text-xs text-slate-300">Competência<input type="month" required value={snapshotForm.period} onChange={(e) => setSnapshotForm((p) => ({ ...p, period: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-600 bg-[#0b1928] px-3 text-sm text-white" /></label>
              <label className="text-xs text-slate-300">Data e hora da captura<input type="datetime-local" required value={snapshotForm.capturedAt} onChange={(e) => setSnapshotForm((p) => ({ ...p, capturedAt: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-600 bg-[#0b1928] px-3 text-sm text-white" /></label>
              <label className="text-xs text-slate-300">Data de fechamento<input type="date" value={snapshotForm.closingDate} onChange={(e) => setSnapshotForm((p) => ({ ...p, closingDate: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-600 bg-[#0b1928] px-3 text-sm text-white" /></label>
              <label className="text-xs text-slate-300">Data de vencimento<input type="date" value={snapshotForm.dueDate} onChange={(e) => setSnapshotForm((p) => ({ ...p, dueDate: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-600 bg-[#0b1928] px-3 text-sm text-white" /></label>
              {([["invoice","Fatura na captura (R$)"],["totalLimit","Limite total na época (R$)"],["usedLimit","Utilizado na época (R$)"],["availableLimit","Disponível na época (R$)"]] as const).map(([key,label]) => <label key={key} className="text-xs text-slate-300">{label}<input inputMode="decimal" placeholder="0,00" value={snapshotForm[key]} onChange={(e) => setSnapshotForm((p) => ({ ...p, [key]: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-600 bg-[#0b1928] px-3 text-sm text-white" /></label>)}
              <div className="flex justify-end gap-2 pt-2 sm:col-span-2"><button type="button" onClick={() => setEditingSnapshot(null)} className="h-9 rounded-lg border border-slate-600 px-4 text-xs font-semibold text-slate-200">Cancelar</button>
                <button type="submit" disabled={savingSnapshot} className="h-9 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white disabled:opacity-50">{savingSnapshot ? "Salvando..." : "Salvar alterações"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bank */}
      {bankOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c1928]/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#0c1928]">{bankEditingId ? "Editar Conta Bancária" : "Nova Conta Bancária"}</h3>
            <form onSubmit={submitBank} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#52616a]">Instituição</label>
                <input
                  value={bankInst}
                  onChange={(e) => setBankInst(e.target.value)}
                  placeholder="Ex.: Banco Inter"
                  className="h-9 w-full rounded-lg border border-[#cbd3d8] px-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#52616a]">Nome da conta</label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Ex.: Conta Digital"
                  className="h-9 w-full rounded-lg border border-[#cbd3d8] px-3 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#52616a]">Final</label>
                  <input
                    value={bankNum}
                    onChange={(e) => setBankNum(e.target.value)}
                    placeholder="1234"
                    maxLength={4}
                    className="h-9 w-full rounded-lg border border-[#cbd3d8] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#52616a]">Saldo inicial (R$)</label>
                  <input
                    value={bankBal}
                    onChange={(e) => setBankBal(e.target.value)}
                    placeholder="0,00"
                    className="tabular-nums h-9 w-full rounded-lg border border-[#cbd3d8] px-3 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBankOpen(false)}
                  className="h-9 rounded-lg border border-[#dce2e6] px-4 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[#173d4a] px-4 text-xs font-semibold text-white"
                >
                  {bankEditingId ? "Salvar alterações" : "Adicionar conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Card */}
      {cardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c1928]/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#0c1928]">Novo Cartão de Crédito</h3>
            <form onSubmit={submitCard} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#52616a]">Instituição</label>
                  <input
                    value={cardInst}
                    onChange={(e) => setCardInst(e.target.value)}
                    placeholder="Ex.: Nubank"
                    className="h-9 w-full rounded-lg border border-[#cbd3d8] px-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#52616a]">Bandeira</label>
                  <select
                    value={cardBrand}
                    onChange={(e) => setCardBrand(e.target.value as CardBrand)}
                    className="h-9 w-full rounded-lg border border-[#cbd3d8] px-2.5 text-sm"
                  >
                    {["MASTERCARD", "VISA", "ELO", "AMEX", "HIPERCARD"].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#52616a]">Apelido do cartão</label>
                <input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Ex.: Platinum"
                  className="h-9 w-full rounded-lg border border-[#cbd3d8] px-3 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#52616a]">Final (4 dígitos)</label>
                  <input
                    value={cardNum}
                    onChange={(e) => setCardNum(e.target.value)}
                    maxLength={4}
                    placeholder="8899"
                    className="h-9 w-full rounded-lg border border-[#cbd3d8] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#52616a]">Limite (R$)</label>
                  <input
                    value={cardLimit}
                    onChange={(e) => setCardLimit(e.target.value)}
                    placeholder="15000,00"
                    className="tabular-nums h-9 w-full rounded-lg border border-[#cbd3d8] px-3 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCardOpen(false)}
                  className="h-9 rounded-lg border border-[#dce2e6] px-4 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[#173d4a] px-4 text-xs font-semibold text-white"
                >
                  Adicionar cartão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
