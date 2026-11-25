import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api.js";
import "./Dashboard.css";

// ==========================================
// HELPERS
// ==========================================

const money = (value) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);


// ==========================================
// INITIAL DASHBOARD DATA
// ==========================================

const initialData = {
    sales: 0,
    customers: 0,
    active: 0,
    completed: 0,
    bills: [],
};


// ==========================================
// DASHBOARD COMPONENT
// ==========================================

export default function DashboardPage({ onNavigate }) {

    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");


    // ==========================================
    // FETCH DASHBOARD DATA
    // ==========================================

    useEffect(() => {
        let live = true;

        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                setError("");

                const paths = [
                    "/sh-bills/",
                    "/sh-bills/customers",
                    "/gi/customers?filter=active",
                    "/gi/customers?filter=completed",
                ];

                const responses = await Promise.all(
                    paths.map((path) => apiFetch(path))
                );

                const results = await Promise.all(
                    responses.map((response) => response.json())
                );

                if (
                    !responses.every((response) => response.ok) ||
                    results.some((result) => result.success === false)
                ) {
                    throw new Error(
                        "Dashboard information is temporarily unavailable."
                    );
                }

                if (!live) return;

                const bills = Array.isArray(results[0].data)
                    ? results[0].data
                    : Array.isArray(results[0].bills)
                        ? results[0].bills
                        : [];

                const customers = Array.isArray(results[1].data)
                    ? results[1].data
                    : Array.isArray(results[1].customers)
                        ? results[1].customers
                        : [];

                const activeCustomers = Array.isArray(results[2].data)
                    ? results[2].data
                    : Array.isArray(results[2].customers)
                        ? results[2].customers
                        : [];

                const completedCustomers = Array.isArray(results[3].data)
                    ? results[3].data
                    : Array.isArray(results[3].customers)
                        ? results[3].customers
                        : [];

                const totalSales = bills.reduce(
                    (total, bill) =>
                        total +
                        Number(bill.grand_total || bill.total_amount || 0),
                    0
                );

                setData({
                    sales: totalSales,
                    customers: customers.length,
                    active: activeCustomers.length,
                    completed: completedCustomers.length,
                    bills: bills.slice(0, 5),
                });

            } catch (err) {
                if (live) {
                    setError(err.message);
                }
            } finally {
                if (live) {
                    setLoading(false);
                }
            }
        };

        fetchDashboardData();

        return () => {
            live = false;
        };
    }, []);


    // ==========================================
    // DASHBOARD METRIC CARDS
    // ==========================================

    const metricCards = [
        {
            label: "Sales recorded",
            value: money(data.sales),
            icon: "▤",
            color: "gold",
            note: "Across fetched bills",
        },
        {
            label: "SH customers",
            value: data.customers,
            icon: "♙",
            color: "mint",
            note: "Registered customers",
        },
        {
            label: "Active Girvi",
            value: data.active,
            icon: "◇",
            color: "peach",
            note: "Open accounts",
        },
        {
            label: "Completed GI",
            value: data.completed,
            icon: "✓",
            color: "lavender",
            note: "Closed accounts",
        },
    ];


    // ==========================================
    // SHOP MODULES
    // ==========================================

    const modules = [
        {
            name: "New SH Bill",
            icon: "＋",
            description: "Create sales invoices",
            color: "gold",
        },
        {
            name: "SH Customers",
            icon: "♙",
            description: "Manage sales customers",
            color: "mint",
        },
        {
            name: "New GI",
            icon: "◇",
            description: "Register pledged jewellery",
            color: "peach",
        },
        {
            name: "GI Customers",
            icon: "♧",
            description: "Manage active accounts",
            color: "lavender",
        },
        {
            name: "GI History",
            icon: "◷",
            description: "Completed Girvi records",
            color: "gold",
        },
        {
            name: "GI Statistics",
            icon: "▥",
            description: "Monthly investment insights",
            color: "mint",
        },
        {
            name: "WhatsApp Chats",
            icon: "☏",
            description: "Manage WhatsApp conversations",
            color: "peach",
        },
    ];


    // ==========================================
    // QUICK ACTIONS
    // ==========================================

    const quickActions = [
        {
            title: "New sales bill",
            description: "Create a jewellery invoice",
            icon: "＋",
            color: "gold",
            module: "New SH Bill",
        },
        {
            title: "New Girvi account",
            description: "Record pledged jewellery",
            icon: "◇",
            color: "mint",
            module: "New GI",
        },
        {
            title: "Find a customer",
            description: "Search customer records",
            icon: "♙",
            color: "lavender",
            module: "SH Customers",
        },
        {
            title: "View GI statistics",
            description: "Review Girvi performance",
            icon: "▥",
            color: "peach",
            module: "GI Statistics",
        },
    ];


    // ==========================================
    // RENDER
    // ==========================================

    return (
        <div className="dashboard-page">

            {/* ----------------------------------
                WELCOME HEADER
            ---------------------------------- */}

            <div className="welcome-row">

                <div>
                    <span className="gi-eyebrow">
                        PRANALI JEWELLERS
                    </span>

                    <h2>
                        <em>Pranali Jewellers Dashboard</em>
                    </h2>
                </div>

                <button
                    className="primary-action"
                    onClick={() => onNavigate("New SH Bill")}
                >
                    ＋ <span>Create bill</span>
                </button>

            </div>


            {/* ----------------------------------
                ERROR MESSAGE
            ---------------------------------- */}

            {error && (
                <div className="inline-alert">
                    {error}

                    <button onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            )}


            {/* ----------------------------------
                DASHBOARD METRICS
            ---------------------------------- */}

            <section className="metric-grid">

                {metricCards.map((card) => (
                    <article className="metric-card" key={card.label}>

                        <div className={`metric-icon ${card.color}`}>
                            {card.icon}
                        </div>

                        <div className="metric-copy">

                            <span>{card.label}</span>

                            <strong>
                                {loading ? "—" : card.value}
                            </strong>

                            <small>{card.note}</small>

                        </div>

                    </article>
                ))}

            </section>


            {/* ----------------------------------
                SHOP MODULES
            ---------------------------------- */}

            <section className="module-launcher-section">

                <div className="section-head">

                    <div>
                        <span className="eyebrow">
                            YOUR WORKSPACE
                        </span>

                        <h2>Shop modules</h2>
                    </div>

                    <span className="module-count">
                        {modules.length} modules
                    </span>

                </div>


                <div className="module-launcher-grid">

                    {modules.map((module) => (

                        <button
                            className="module-launcher-card"
                            key={module.name}
                            onClick={() => onNavigate(module.name)}
                        >

                            <span
                                className={`module-launcher-icon ${module.color}`}
                            >
                                {module.icon}
                            </span>

                            <span className="module-launcher-copy">

                                <b>{module.name}</b>

                                <small>{module.description}</small>

                            </span>

                            <i>↗</i>

                        </button>

                    ))}

                </div>

            </section>


            {/* ----------------------------------
                DASHBOARD LOWER SECTION
            ---------------------------------- */}

            <div className="dashboard-grid">


                {/* ----------------------------------
                    RECENT BILLS
                ---------------------------------- */}

                <section className="surface-card recent-card">

                    <div className="section-head">

                        <div>
                            <span className="eyebrow">
                                SALES MANAGEMENT
                            </span>

                            <h2>Recent bills</h2>
                        </div>

                        <button
                            className="text-action"
                            onClick={() => onNavigate("New SH Bill")}
                        >
                            Create new ↗
                        </button>

                    </div>


                    <div className="table-scroll">

                        <table>

                            <thead>
                                <tr>
                                    <th>Bill number</th>
                                    <th>Customer</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                </tr>
                            </thead>


                            <tbody>

                                {loading ? (

                                    <tr>
                                        <td colSpan="4">
                                            Loading bills…
                                        </td>
                                    </tr>

                                ) : data.bills.length > 0 ? (

                                    data.bills.map((bill, index) => (

                                        <tr key={bill.id || bill.bill_number || index}>

                                            <td className="strong-cell">
                                                {bill.bill_number ||
                                                    bill.invoice_no ||
                                                    `Bill ${index + 1}`}
                                            </td>

                                            <td>
                                                {bill.customer_name ||
                                                    bill.customerName ||
                                                    "—"}
                                            </td>

                                            <td>
                                                {money(
                                                    bill.grand_total ||
                                                    bill.total_amount
                                                )}
                                            </td>

                                            <td>
                                                {bill.bill_date
                                                    ? new Date(
                                                        bill.bill_date
                                                    ).toLocaleDateString("en-IN")
                                                    : "—"}
                                            </td>

                                        </tr>

                                    ))

                                ) : (

                                    <tr>
                                        <td colSpan="4">
                                            No recent bills available.
                                        </td>
                                    </tr>

                                )}

                            </tbody>

                        </table>

                    </div>

                </section>


                {/* ----------------------------------
                    QUICK ACTIONS
                ---------------------------------- */}

                <section className="surface-card quick-card">

                    <div className="section-head">

                        <div>
                            <span className="eyebrow">
                                QUICK ACTIONS
                            </span>

                            <h2>What would you like to do?</h2>
                        </div>

                    </div>


                    <div className="quick-actions">

                        {quickActions.map((action) => (

                            <button
                                key={action.title}
                                onClick={() => onNavigate(action.module)}
                            >

                                <span className={`quick-icon ${action.color}`}>
                                    {action.icon}
                                </span>

                                <span>

                                    <b>{action.title}</b>

                                    <small>{action.description}</small>

                                </span>

                                <i>›</i>

                            </button>

                        ))}

                    </div>

                </section>

            </div>

        </div>
    );
}