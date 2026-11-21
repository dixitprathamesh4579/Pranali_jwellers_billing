import { useCallback, useEffect, useMemo, useState } from "react";
import "./DailyAccounts.css";
import { apiFetch } from "../utils/api.js";

const emptyForm = () => ({
    transaction_date: new Date().toLocaleDateString("en-CA"),
    amount: "",
    transaction_type: "CREDIT",
    reason: "",
    e_type: "SALES",
});

const categories = {
    CREDIT: [
        { value: "SALES", label: "Sales" },
        { value: "INCOME", label: "Income" },
        { value: "OTHERS", label: "Others" },
    ],
    DEBIT: [
        { value: "INVESTMENT", label: "Investment" },
        { value: "EXPENSES", label: "Expenses" },
        { value: "OTHERS", label: "Others" },
    ],
};

const money = (value) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(value || 0));

const monthKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function DailyAccounts() {
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({ totalCredit: 0, totalDebit: 0, netBalance: 0 });
    const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
    const [filter, setFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());

    const [year, month] = selectedMonth.split("-").map(Number);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [transactionsResponse, summaryResponse] = await Promise.all([
                apiFetch("/daily-accounts"),
                apiFetch(`/daily-accounts/summary/monthly?month=${month}&year=${year}`),
            ]);

            const transactionsData = await transactionsResponse.json();
            const summaryData = await summaryResponse.json();

            if (!transactionsResponse.ok || !transactionsData.success) {
                throw new Error(transactionsData.message || "Unable to load transactions.");
            }
            if (!summaryResponse.ok || !summaryData.success) {
                throw new Error(summaryData.message || "Unable to load monthly summary.");
            }

            setTransactions(transactionsData.transactions || []);
            setSummary({
                totalCredit: Number(summaryData.totalCredit || 0),
                totalDebit: Number(summaryData.totalDebit || 0),
                netBalance: Number(summaryData.netBalance || 0),
            });
        } catch (err) {
            setError(err.message || "Unable to connect to Daily Accounts API.");
        } finally {
            setLoading(false);
        }
    }, [month, year]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const visibleTransactions = useMemo(() => {
        return transactions.filter((item) => {
            const date = String(item.transaction_date || "").slice(0, 10);
            const inMonth = date.startsWith(selectedMonth);
            const matchesFilter = filter === "ALL" || item.transaction_type === filter;
            return inMonth && matchesFilter;
        });
    }, [transactions, selectedMonth, filter]);

    const openAddForm = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowForm(true);
    };

    const openEditForm = (item) => {
        setEditingId(item.id);
        setForm({
            transaction_date: String(item.transaction_date || "").slice(0, 10),
            amount: String(item.amount ?? ""),
            transaction_type: item.transaction_type,
            reason: item.reason || "",
            e_type: item.e_type,
        });
        setShowForm(true);
    };

    const handleTypeChange = (type) => {
        setForm((current) => ({
            ...current,
            transaction_type: type,
            e_type: categories[type][0].value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");

        try {
            const payload = {
                ...form,
                amount: Number(form.amount),
                reason: form.reason.trim() || null,
            };

            const response = await apiFetch(
                editingId
                    ? `/daily-accounts/${editingId}`
                    : "/daily-accounts",
                {
                    method: editingId ? "PUT" : "POST",
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to save transaction.");
            }

            setShowForm(false);
            setEditingId(null);
            setForm(emptyForm());
            await fetchData();
        } catch (err) {
            setError(err.message || "Unable to save transaction.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Permanently delete this transaction?")) return;

        setError("");
        try {
            const response = await apiFetch(`/daily-accounts/${id}`, {
                method: "DELETE",
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to delete transaction.");
            }
            await fetchData();
        } catch (err) {
            setError(err.message || "Unable to delete transaction.");
        }
    };

    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
    });

    return (
        <section className="da-page">
            <div className="da-heading">
                <div>
                    <h1>Daily Accounts</h1>
                    <p>Track your shop's income, sales, expenses and investments.</p>
                </div>
                <button className="da-primary-btn" onClick={openAddForm}>+ Add Transaction</button>
            </div>

            <div className="da-period-bar">
                <div>
                    <span className="da-eyebrow">MONTHLY OVERVIEW</span>
                    <h2>{monthLabel}</h2>
                </div>
                <input
                    aria-label="Select month"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                />
            </div>

            <div className="da-summary-grid">
                <article className="da-summary-card da-credit">
                    <span>Income / Sales</span>
                    <strong>{loading ? "Loading..." : money(summary.totalCredit)}</strong>
                    <small>Total CREDIT for selected month</small>
                </article>
                <article className="da-summary-card da-debit">
                    <span>Expenses / Investment</span>
                    <strong>{loading ? "Loading..." : money(summary.totalDebit)}</strong>
                    <small>Total DEBIT for selected month</small>
                </article>
                <article className="da-summary-card da-balance">
                    <span>Net Balance</span>
                    <strong>{loading ? "Loading..." : money(summary.netBalance)}</strong>
                    <small>Income / Sales minus Expenses / Investment</small>
                </article>
            </div>

            {error && <div className="da-error" role="alert">{error}</div>}

            {showForm && (
                <div className="da-modal-backdrop">
                    <form className="da-modal" onSubmit={handleSubmit}>
                        <div className="da-modal-heading">
                            <h2>{editingId ? "Edit Transaction" : "Add Transaction"}</h2>
                            <button type="button" className="da-close-btn" onClick={() => setShowForm(false)}>×</button>
                        </div>

                        <label>
                            Date
                            <input
                                type="date"
                                value={form.transaction_date}
                                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                                required
                            />
                        </label>

                        <label>
                            Type
                            <select value={form.transaction_type} onChange={(e) => handleTypeChange(e.target.value)}>
                                <option value="CREDIT">CREDIT – Income / Sales</option>
                                <option value="DEBIT">DEBIT – Expenses / Investment</option>
                            </select>
                        </label>

                        <label>
                            E-Type
                            <select
                                value={form.e_type}
                                onChange={(e) => setForm({ ...form, e_type: e.target.value })}
                                required
                            >
                                {categories[form.transaction_type].map((category) => (
                                    <option key={category.value} value={category.value}>{category.label}</option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Amount (₹)
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                placeholder="Enter amount"
                                required
                            />
                        </label>

                        <label>
                            Reason
                            <textarea
                                rows="3"
                                maxLength="255"
                                value={form.reason}
                                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                placeholder="Enter transaction reason (optional)"
                            />
                        </label>

                        <div className="da-form-actions">
                            <button type="button" className="da-secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
                            <button type="submit" className="da-primary-btn" disabled={saving}>
                                {saving ? "Saving..." : editingId ? "Update Transaction" : "Save Transaction"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="da-history-panel">
                <div className="da-history-heading">
                    <div>
                        <h2>Transaction Records</h2>
                        <p>{visibleTransactions.length} record(s) in {monthLabel}</p>
                    </div>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter transactions">
                        <option value="ALL">All Transactions</option>
                        <option value="CREDIT">Credit</option>
                        <option value="DEBIT">Debit</option>
                    </select>
                </div>

                <div className="da-table-wrap">
                    <table className="da-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Type</th>
                                <th>Reason</th>
                                <th>E-Type</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="da-empty">Loading transactions...</td></tr>
                            ) : visibleTransactions.length === 0 ? (
                                <tr><td colSpan="7" className="da-empty">No transactions found for this month.</td></tr>
                            ) : visibleTransactions.map((item) => (
                                <tr key={item.id}>
                                    <td>#{item.id}</td>
                                    <td>{String(item.transaction_date || "").slice(0, 10)}</td>
                                    <td className="da-amount">{money(item.amount)}</td>
                                    <td><span className={`da-badge ${item.transaction_type === "CREDIT" ? "credit" : "debit"}`}>{item.transaction_type}</span></td>
                                    <td>{item.reason || "—"}</td>
                                    <td>{String(item.e_type || "").replace("_", " ")}</td>
                                    <td>
                                        <div className="da-row-actions">
                                            <button type="button" onClick={() => openEditForm(item)}>Edit</button>
                                            <button type="button" className="delete" onClick={() => handleDelete(item.id)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
