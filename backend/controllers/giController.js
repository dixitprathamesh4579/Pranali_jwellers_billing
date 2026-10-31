const pool = require("../config/db");

const {
    generateGINumber,
    calculateGIInterest,
    calculateGIBalance
} = require("../services/giService");


// CREATE NEW GI ACCOUNT
const createGI = async (req, res) => {

    let connection;

    try {

        const {
            customer,
            items,
            principal,
            interestRate,
            girviDate
        } = req.body;

        // 1. BASIC VALIDATION

        if (
            !customer ||
            !customer.name ||
            !customer.phone ||
            !Array.isArray(items) ||
            items.length === 0 ||
            !principal ||
            !girviDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required GI details."
            });
        }

        const phone = String(customer.phone).trim();
        const amount = Number(principal);
        const rate = Number(interestRate || 3);

        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Customer phone must contain 10 digits."
            });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Principal amount must be greater than zero."
            });
        }

        if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid monthly interest rate."
            });
        }

        // VALIDATE GI DATE (Timezone-safe)

        if (
            typeof girviDate !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(girviDate)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid GI date."
            });
        }

        const [year, month, day] = girviDate.split("-").map(Number);

        const date = new Date(year, month - 1, day);

        // Validate actual calendar date
        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid GI date."
            });
        }

        // Prevent future GI dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (date > today) {
            return res.status(400).json({
                success: false,
                message: "GI date cannot be in the future."
            });
        }
        // 2. VALIDATE ITEMS

        for (const item of items) {

            const grossWeight = Number(item.grossWeight);
            const deductionWeight = Number(item.deductionWeight || 0);

            if (
                !item.itemType ||
                !Number.isFinite(grossWeight) ||
                !Number.isFinite(deductionWeight) ||
                grossWeight <= 0 ||
                deductionWeight < 0 ||
                deductionWeight > grossWeight
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please check the deposited item details and weights."
                });
            }
        }

        // 3. START DATABASE TRANSACTION

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // 4. GENERATE GI NUMBER

        const giNumber = await generateGINumber(connection);

        // 5. FIND EXISTING CUSTOMER

        const [existingCustomers] = await connection.execute(
            `SELECT id
             FROM gi_customers
             WHERE phone = ?
             LIMIT 1`,
            [phone]
        );

        let customerId;

        if (existingCustomers.length > 0) {

            customerId = existingCustomers[0].id;

            await connection.execute(
                `UPDATE gi_customers
                 SET name = ?,
                     address = ?,
                     id_reference = ?
                 WHERE id = ?`,
                [
                    customer.name.trim(),
                    customer.address || null,
                    customer.idReference || null,
                    customerId
                ]
            );

        } else {

            const [customerResult] = await connection.execute(
                `INSERT INTO gi_customers
                 (name, phone, address, id_reference)
                 VALUES (?, ?, ?, ?)`,
                [
                    customer.name.trim(),
                    phone,
                    customer.address || null,
                    customer.idReference || null
                ]
            );

            customerId = customerResult.insertId;
        }

        // 6. CREATE GI ACCOUNT

        const [accountResult] = await connection.execute(
            `INSERT INTO gi_accounts
             (
                gi_number,
                customer_id,
                principal,
                interest_rate,
                interest_period,
                gi_date,
                account_status
             )
             VALUES (?, ?, ?, ?, 'MONTHLY', ?, 'ACTIVE')`,
            [
                giNumber,
                customerId,
                amount,
                rate,
                girviDate
            ]
        );

        const giAccountId = accountResult.insertId;

        // 7. SAVE ALL DEPOSITED ITEMS

        for (const item of items) {

            const grossWeight = Number(item.grossWeight);

            const deductionWeight = Number(
                item.deductionWeight || 0
            );

            const netWeight = Number(
                (grossWeight - deductionWeight).toFixed(3)
            );

            await connection.execute(
                `INSERT INTO gi_items
                 (
                    gi_account_id,
                    item_type,
                    item_name,
                    purity,
                    gross_weight,
                    deduction_weight,
                    net_weight,
                    description
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    giAccountId,
                    item.itemType,
                    item.itemName || null,
                    item.purity || null,
                    grossWeight,
                    deductionWeight,
                    netWeight,
                    item.description || null
                ]
            );
        }

        // 8. RECORD INITIAL DISBURSEMENT

        await connection.execute(
            `INSERT INTO gi_transactions
             (
                gi_account_id,
                transaction_type,
                amount,
                principal_paid,
                interest_paid,
                transaction_date,
                payment_method,
                description
             )
             VALUES (?, 'DISBURSEMENT', ?, 0, 0, ?, 'CASH', ?)`,
            [
                giAccountId,
                amount,
                `${girviDate} 00:00:00`,
                "Initial GI amount given to customer"
            ]
        );

        // 9. COMMIT TRANSACTION

        await connection.commit();

        return res.status(201).json({

            success: true,

            message: "GI account created successfully!",

            gi: {
                id: giAccountId,
                gi_number: giNumber,
                customer_id: customerId,
                customer_name: customer.name,
                principal: amount,
                interest_rate: rate,
                interest_period: "MONTHLY",
                gi_date: girviDate,
                account_status: "ACTIVE"
            }

        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error("Create GI Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create GI account."
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
};



// ==========================================
// GET ALL GI CUSTOMERS
// ACTIVE / COMPLETED / ALL
// ==========================================

const getAllGICustomers = async (req, res) => {

    try {

        const {
            search = "",
            filter = "all"
        } = req.query;

        // Validate filter
        if (!["all", "active", "completed"].includes(filter)) {
            return res.status(400).json({
                success: false,
                message: "Invalid filter. Use all, active or completed."
            });
        }

        const searchValue = `%${search.trim()}%`;

        let sql = `
            SELECT
                ga.id AS gi_id,
                ga.gi_number,
                ga.customer_id,

                ga.principal AS original_principal,
                ga.interest_rate,
                ga.interest_period,

                ga.gi_date,
                ga.account_status,
                ga.completed_at,
                ga.created_at,

                gc.name AS customer_name,
                gc.phone AS customer_phone,
                gc.address AS customer_address,
                gc.id_reference

            FROM gi_accounts ga

            INNER JOIN gi_customers gc
                ON ga.customer_id = gc.id

            WHERE (
                ? = ''
                OR gc.name LIKE ?
                OR gc.phone LIKE ?
                OR ga.gi_number LIKE ?
            )
        `;

        const queryParams = [
            search.trim(),
            searchValue,
            searchValue,
            searchValue
        ];

        // Apply account status filter
        if (filter === "active") {
            sql += ` AND ga.account_status = 'ACTIVE'`;
        }

        if (filter === "completed") {
            sql += ` AND ga.account_status = 'COMPLETED'`;
        }

        sql += ` ORDER BY ga.created_at DESC`;

        const [accounts] = await pool.execute(sql, queryParams);

        // Fetch jewellery items
        if (accounts.length > 0) {

            const accountIds = accounts.map(
                account => account.gi_id
            );

            const placeholders = accountIds
                .map(() => "?")
                .join(",");

            const [items] = await pool.query(
                `
                SELECT *
                FROM gi_items
                WHERE gi_account_id IN (${placeholders})
                ORDER BY id ASC
                `,
                accountIds
            );

            // Group jewellery items by GI account
            const itemMap = {};

            items.forEach(item => {

                if (!itemMap[item.gi_account_id]) {
                    itemMap[item.gi_account_id] = [];
                }

                itemMap[item.gi_account_id].push(item);
            });

            // Calculate actual outstanding balance
            for (const account of accounts) {

                account.items = itemMap[account.gi_id] || [];
                account.item_names = account.items
                    .map(item => item.item_name || item.item_type)
                    .join(", ");

                const balance = await calculateGIBalance(
                    pool,
                    {
                        id: account.gi_id,
                        principal: account.original_principal,
                        interest_rate: account.interest_rate,
                        gi_date: account.gi_date
                    },
                    new Date() // Today's date
                );

                account.principal = Number(balance.principal);
                account.interest_amount = Number(balance.interest);
                account.total_due = Number(balance.totalDue);

                account.interest_rate = Number(
                    account.interest_rate
                );
            }
        }

        return res.status(200).json({

            success: true,

            count: accounts.length,

            customers: accounts

        });

    } catch (error) {

        console.error("Get GI Customers Error:", error);

        return res.status(500).json({

            success: false,

            message: "Failed to fetch GI customers."

        });
    }
};



// ==========================================
// RECORD GI PAYMENT
// INTEREST PAYMENT / PRINCIPAL PAYMENT
// ==========================================

const recordGIPayment = async (req, res) => {

    const {
        giAccountId,
        amount,
        paymentType,
        paymentDate,
        paymentMethod,
        description
    } = req.body;

    // BASIC VALIDATION
    if (!giAccountId || !amount || !paymentDate || !paymentType) {
        return res.status(400).json({
            success: false,
            message: "GI account, amount, payment type and date are required."
        });
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Payment amount must be greater than zero."
        });
    }

    if (!["INTEREST", "PRINCIPAL", "FULL_SETTLEMENT"].includes(paymentType)) {
        return res.status(400).json({
            success: false,
            message: "Payment type must be INTEREST, PRINCIPAL or FULL_SETTLEMENT."
        });
    }

    // VALIDATE PAYMENT DATE
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(paymentDate);

    if (!dateMatch) {
        return res.status(400).json({
            success: false,
            message: "Invalid payment date. Use YYYY-MM-DD."
        });
    }

    const [, year, month, day] = dateMatch;

    const parsedDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
    );

    if (
        parsedDate.getFullYear() !== Number(year) ||
        parsedDate.getMonth() !== Number(month) - 1 ||
        parsedDate.getDate() !== Number(day)
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid calendar date."
        });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (parsedDate > today) {
        return res.status(400).json({
            success: false,
            message: "Payment date cannot be in the future."
        });
    }

    let connection;

    try {

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // LOCK GI ACCOUNT
        const [accounts] = await connection.query(
            `SELECT *
             FROM gi_accounts
             WHERE id = ?
             FOR UPDATE`,
            [giAccountId]
        );

        if (accounts.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "GI account not found."
            });
        }

        const account = accounts[0];

        if (account.account_status !== "ACTIVE") {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "This GI account is already completed."
            });
        }

        const paymentDateTime = `${paymentDate} 23:59:59`;

        // PREVENT BACKDATED PAYMENTS
        const [lastTransactions] = await connection.query(
            `SELECT transaction_date
             FROM gi_transactions
             WHERE gi_account_id = ?
             ORDER BY transaction_date DESC, id DESC
             LIMIT 1`,
            [giAccountId]
        );

        if (lastTransactions.length > 0) {
            const lastTransactionDate = new Date(
                lastTransactions[0].transaction_date
            );

            const requestedDate = new Date(`${paymentDate}T23:59:59`);

            if (requestedDate < lastTransactionDate) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Payment date cannot be earlier than the last transaction."
                });
            }
        }
        // CALCULATE CURRENT BALANCE
        const balance = await calculateGIBalance(
            connection,
            account,
            paymentDateTime
        );

        let principalPaid = 0;
        let interestPaid = 0;
        let transactionType;

        // ======================================
        // INTEREST PAYMENT
        // ======================================

        if (paymentType === "INTEREST") {

            if (balance.interest <= 0) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "There is no outstanding interest to pay."
                });
            }

            if (paymentAmount > balance.interest + 0.001) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: `Maximum interest payment is ₹${balance.interest.toFixed(2)}.`
                });
            }

            interestPaid = paymentAmount;

            transactionType = "INTEREST_PAYMENT";
        }

        // ======================================
        // PRINCIPAL PAYMENT
        // ======================================

        if (paymentType === "PRINCIPAL") {

            if (balance.principal <= 0) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "There is no outstanding principal."
                });
            }

            if (paymentAmount > balance.principal + 0.001) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: `Maximum principal payment is ₹${balance.principal.toFixed(2)}.`
                });
            }

            principalPaid = paymentAmount;

            transactionType = "PAYMENT";
        }
        // ======================================
        // FULL SETTLEMENT
        // ======================================

        if (paymentType === "FULL_SETTLEMENT") {

            const totalOutstanding = Number(
                balance.totalDue
            );

            if (totalOutstanding <= 0) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "There is no outstanding amount to settle."
                });
            }

            if (Math.abs(paymentAmount - totalOutstanding) > 0.01) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: `Full settlement amount must be ₹${totalOutstanding.toFixed(2)}.`
                });
            }

            // Split the full payment into interest and principal.
            interestPaid = Number(balance.interest);
            principalPaid = Number(balance.principal);

            transactionType = "PAYMENT";
        }
        // ======================================
        // SAVE TRANSACTION
        // ======================================

        await connection.query(
            `INSERT INTO gi_transactions
            (
                gi_account_id,
                transaction_type,
                amount,
                transaction_date,
                payment_method,
                description,
                principal_paid,
                interest_paid
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                giAccountId,
                transactionType,
                paymentAmount,
                paymentDateTime,
                paymentMethod || "CASH",
                description || `${paymentType} payment`,
                principalPaid,
                interestPaid
            ]
        );

        // ======================================
        // CALCULATE UPDATED BALANCE
        // ======================================

        const updatedBalance = await calculateGIBalance(
            connection,
            account,
            paymentDateTime
        );

        // ======================================
        // COMPLETE ACCOUNT IF ALL DUES CLEARED
        // ======================================

        if (
            updatedBalance.principal <= 0.001 &&
            updatedBalance.interest <= 0.001
        ) {

            await connection.query(
                `UPDATE gi_accounts
                 SET account_status = 'COMPLETED',
                     completed_at = NOW()
                 WHERE id = ?`,
                [giAccountId]
            );
        }

        await connection.commit();

        return res.status(201).json({

            success: true,

            message: "GI payment recorded successfully.",

            payment: {
                giAccountId: account.id,
                giNumber: account.gi_number,

                paymentType,
                amount: paymentAmount,

                principalPaid,
                interestPaid,

                remainingPrincipal: updatedBalance.principal,
                remainingInterest: updatedBalance.interest,
                totalRemaining: updatedBalance.totalDue,

                accountStatus:
                    updatedBalance.principal <= 0.001 &&
                        updatedBalance.interest <= 0.001
                        ? "COMPLETED"
                        : "ACTIVE"
            }

        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error("GI Payment Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to record GI payment."
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
};
// ==========================================
// GET COMPLETED GI HISTORY
// ==========================================

const getGIHistory = async (req, res) => {
    try {
        const { search = "" } = req.query;

        const searchText = search.trim();
        const searchValue = `%${searchText}%`;

        // 1. FETCH COMPLETED GI ACCOUNTS
        const [accounts] = await pool.execute(
            `
            SELECT
                ga.id AS gi_id,
                ga.gi_number,
                ga.customer_id,
                ga.principal AS original_principal,
                ga.interest_rate,
                ga.interest_period,
                ga.gi_date,
                ga.completed_at,
                ga.created_at,

                gc.name AS customer_name,
                gc.phone AS customer_phone,
                gc.address AS customer_address,
                gc.id_reference

            FROM gi_accounts ga

            INNER JOIN gi_customers gc
                ON ga.customer_id = gc.id

            WHERE
                ga.account_status = 'COMPLETED'
                AND (
                    ? = ''
                    OR gc.name LIKE ?
                    OR gc.phone LIKE ?
                    OR ga.gi_number LIKE ?
                )

            ORDER BY ga.completed_at DESC, ga.id DESC
            `,
            [
                searchText,
                searchValue,
                searchValue,
                searchValue
            ]
        );

        // 2. RETURN EMPTY HISTORY
        if (accounts.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                history: []
            });
        }

        // 3. GET ALL GI ACCOUNT IDS
        const accountIds = accounts.map(
            (account) => account.gi_id
        );

        const placeholders = accountIds
            .map(() => "?")
            .join(",");

        // 4. FETCH JEWELLERY ITEMS
        const [items] = await pool.query(
            `
            SELECT *
            FROM gi_items
            WHERE gi_account_id IN (${placeholders})
            ORDER BY id ASC
            `,
            accountIds
        );

        // 5. FETCH PAYMENT TOTALS
        const [payments] = await pool.query(
            `
            SELECT
                gi_account_id,
                SUM(principal_paid) AS total_principal_paid,
                SUM(interest_paid) AS total_interest_paid

            FROM gi_transactions

            WHERE
                gi_account_id IN (${placeholders})
                AND transaction_type IN (
                    'PAYMENT',
                    'INTEREST_PAYMENT'
                )

            GROUP BY gi_account_id
            `,
            accountIds
        );

        // 6. GROUP ITEMS BY GI ACCOUNT
        const itemMap = {};

        items.forEach((item) => {

            if (!itemMap[item.gi_account_id]) {
                itemMap[item.gi_account_id] = [];
            }

            itemMap[item.gi_account_id].push(item);
        });

        // 7. GROUP PAYMENTS BY GI ACCOUNT
        const paymentMap = {};

        payments.forEach((payment) => {

            // IMPORTANT: Use payment.gi_account_id
            // Do not use account.gi_id here.
            paymentMap[payment.gi_account_id] = payment;

        });

        // 8. PREPARE FINAL HISTORY RESPONSE
        const history = accounts.map((account) => {

            const accountItems =
                itemMap[account.gi_id] || [];

            const payment =
                paymentMap[account.gi_id] || {};

            const principalPaid = Number(
                payment.total_principal_paid || 0
            );

            const interestPaid = Number(
                payment.total_interest_paid || 0
            );

            const totalRecovered = Number(
                (principalPaid + interestPaid).toFixed(2)
            );

            return {
                ...account,

                items: accountItems,

                item_names: accountItems
                    .map((item) => item.item_name || item.item_type)
                    .join(", "),

                total_principal_paid: principalPaid,

                total_interest_paid: interestPaid,

                total_recovered: totalRecovered
            };
        });

        // 9. SEND RESPONSE
        return res.status(200).json({
            success: true,
            count: history.length,
            history
        });

    } catch (error) {

        console.error("GI History Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch GI history.",
            error: error.message
        });
    }
};

// ==========================================
// GET GI STATISTICS
// ==========================================

const getGIStatistics = async (req, res) => {

    try {

        // 1. FETCH ALL GI ACCOUNTS
        const [accounts] = await pool.execute(
            `
            SELECT
                id,
                gi_number,
                principal,
                interest_rate,
                interest_period,
                gi_date,
                account_status,
                completed_at,
                created_at

            FROM gi_accounts

            ORDER BY created_at DESC
            `
        );

        // 2. FETCH PAYMENT TOTALS
        const [paymentRows] = await pool.execute(
            `
            SELECT

                COUNT(DISTINCT gi_account_id) AS accounts_with_payments,

                SUM(principal_paid) AS total_principal_paid,

                SUM(interest_paid) AS total_interest_paid,

                SUM(amount) AS total_payment_amount

            FROM gi_transactions

            WHERE transaction_type IN (
                'PAYMENT',
                'INTEREST_PAYMENT'
            )
            `
        );

        // 3. INITIALIZE STATISTICS
        let totalAccounts = accounts.length;

        let activeAccounts = 0;
        let completedAccounts = 0;

        let totalPrincipalDisbursed = 0;

        let outstandingPrincipal = 0;
        let outstandingInterest = 0;

        // 4. CALCULATE ACCOUNT-WISE BALANCES
        for (const account of accounts) {

            totalPrincipalDisbursed += Number(
                account.principal || 0
            );

            if (account.account_status === "ACTIVE") {

                activeAccounts++;

                const balance = await calculateGIBalance(
                    pool,
                    {
                        id: account.id,
                        principal: account.principal,
                        interest_rate: account.interest_rate,
                        gi_date: account.gi_date
                    },
                    new Date()
                );

                outstandingPrincipal += Number(
                    balance.principal || 0
                );

                outstandingInterest += Number(
                    balance.interest || 0
                );

            } else if (
                account.account_status === "COMPLETED"
            ) {

                completedAccounts++;

            }
        }

        // 5. GET RECOVERED AMOUNTS
        const paymentStats = paymentRows[0] || {};

        const totalPrincipalRecovered = Number(
            paymentStats.total_principal_paid || 0
        );

        const totalInterestRecovered = Number(
            paymentStats.total_interest_paid || 0
        );

        const totalRecovered = Number(
            (
                totalPrincipalRecovered +
                totalInterestRecovered
            ).toFixed(2)
        );

        // 6. CALCULATE TOTAL OUTSTANDING
        outstandingPrincipal = Number(
            outstandingPrincipal.toFixed(2)
        );

        outstandingInterest = Number(
            outstandingInterest.toFixed(2)
        );

        const totalOutstanding = Number(
            (
                outstandingPrincipal +
                outstandingInterest
            ).toFixed(2)
        );

        totalPrincipalDisbursed = Number(
            totalPrincipalDisbursed.toFixed(2)
        );

        // 7. SEND RESPONSE
        return res.status(200).json({

            success: true,

            statistics: {

                total_accounts: totalAccounts,

                active_accounts: activeAccounts,

                completed_accounts: completedAccounts,

                total_principal_disbursed:
                    totalPrincipalDisbursed,

                outstanding_principal:
                    outstandingPrincipal,

                outstanding_interest:
                    outstandingInterest,

                total_outstanding:
                    totalOutstanding,

                total_principal_recovered:
                    totalPrincipalRecovered,

                total_interest_recovered:
                    totalInterestRecovered,

                total_recovered:
                    totalRecovered

            }

        });

    } catch (error) {

        console.error("GI Statistics Error:", error);

        return res.status(500).json({

            success: false,

            message: "Failed to fetch GI statistics.",

            error: error.message

        });

    }

};

module.exports = {
    createGI,
    getAllGICustomers,
    recordGIPayment,
    getGIHistory,
    getGIStatistics
};