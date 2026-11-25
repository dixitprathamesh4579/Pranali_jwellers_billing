// ==========================================
// MORE PAGE MODULES
// ==========================================

const modules = [
    {
        name: "WhatsApp Chats",
        icon: "☏",
        desc: "Manage customer conversations",
        tone: "rose",
    },
    {
        name: "GI Customers",
        icon: "♧",
        desc: "Manage active Girvi accounts",
        tone: "mint",
    },
    {
        name: "GI History",
        icon: "◷",
        desc: "View completed Girvi records",
        tone: "gold",
    },
    {
        name: "GI Statistics",
        icon: "▥",
        desc: "Review monthly investments",
        tone: "lavender",
    },
    {
        name: "DailyAccounts",
        icon: "✎",
        desc: "Manage daily transactions",
        tone: "sky",
    },
];


// ==========================================
// MORE PAGE COMPONENT
// ==========================================

export default function MorePage({ onNavigate, onLogout, user }) {

    const accountName = user?.name || "Shop account";

    const accountEmail =
        user?.email || "Signed in to Pranali Jewellers";

    const avatarLetter = (
        user?.name ||
        user?.email ||
        "P"
    ).slice(0, 1).toUpperCase();


    return (
        <section className="more-page">

            {/* PAGE HEADER */}

            <div className="more-welcome">

                <span className="eyebrow">
                    PRANALI JEWELLERS
                </span>

                <h1>More workspace tools</h1>

                <p>
                    Everything else you need to manage your shop.
                </p>

            </div>


            {/* MODULE LIST */}

            <div className="more-module-grid">

                {modules.map((module) => (

                    <button
                        className="more-module-card"
                        key={module.name}
                        onClick={() => onNavigate(module.name)}
                    >

                        <span
                            className={`more-module-icon ${module.tone}`}
                        >
                            {module.icon}
                        </span>

                        <span className="more-module-copy">

                            <strong>{module.name}</strong>

                            <small>{module.desc}</small>

                        </span>

                        <i>›</i>

                    </button>

                ))}

            </div>


            {/* ACCOUNT SETTINGS */}

            <section className="account-settings-card">

                <div className="account-settings-avatar">
                    {avatarLetter}
                </div>

                <div>
                    <strong>{accountName}</strong>
                    <small>{accountEmail}</small>
                </div>

                <button onClick={onLogout}>
                    Sign out ↗
                </button>

            </section>

        </section>
    );
}