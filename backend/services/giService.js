// ==========================================
// GENERATE GI NUMBER
// ==========================================

const generateGINumber = async (connection) => {

    const [rows] = await connection.query(
        `SELECT next_number
         FROM gi_number_sequence
         WHERE id = 1
         FOR UPDATE`
    );

    if (rows.length === 0) {
        throw new Error("GI number sequence not initialized.");
    }

    const nextNumber = Number(rows[0].next_number);

    await connection.query(
        `UPDATE gi_number_sequence
         SET next_number = next_number + 1
         WHERE id = 1`
    );

    return `GI-${String(nextNumber).padStart(4, "0")}`;
};


// ==========================================
// NORMALIZE DATE
// ==========================================

const toDateOnly = (value) => {

    if (value instanceof Date) {

        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    return String(value).slice(0, 10);
};


// ==========================================
// CALCULATE SIMPLE MONTHLY INTEREST
// ==========================================

const calculateGIInterest = (
    principal,
    rate,
    startDate,
    endDate = new Date()
) => {

    const amount = Number(principal);
    const monthlyRate = Number(rate);

    if (amount <= 0 || !startDate) {
        return {
            completedMonths: 0,
            remainingDays: 0,
            interest: 0
        };
    }

    const parseDate = (value) => {

        const dateString = toDateOnly(value);

        const [year, month, day] = dateString
            .split("-")
            .map(Number);

        return new Date(year, month - 1, day);
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (start > end) {
        return {
            completedMonths: 0,
            remainingDays: 0,
            interest: 0
        };
    }

    let completedMonths =
        (end.getFullYear() - start.getFullYear()) * 12 +
        end.getMonth() - start.getMonth();

    const getAnniversary = (months) => {

        const targetMonth = start.getMonth() + months;

        const year = start.getFullYear() +
            Math.floor(targetMonth / 12);

        const month = ((targetMonth % 12) + 12) % 12;

        const lastDay = new Date(
            year,
            month + 1,
            0
        ).getDate();

        return new Date(
            year,
            month,
            Math.min(start.getDate(), lastDay)
        );
    };

    let anniversary = getAnniversary(completedMonths);

    if (anniversary > end) {
        completedMonths--;
        anniversary = getAnniversary(completedMonths);
    }

    const remainingDays = Math.floor(
        (end - anniversary) / (1000 * 60 * 60 * 24)
    );

    const monthlyInterest = amount * (monthlyRate / 100);

    let interest = completedMonths * monthlyInterest;

    if (remainingDays >= 1 && remainingDays <= 15) {

        interest += monthlyInterest / 2;

    } else if (remainingDays > 15) {

        interest += monthlyInterest;
    }

    return {
        completedMonths,
        remainingDays,
        interest: Number(interest.toFixed(2))
    };
};


// ==========================================
// CALCULATE GI OUTSTANDING BALANCE
// ==========================================

const calculateGIBalance = async (
    connection,
    account,
    asOfDate = new Date()
) => {

    const [transactions] = await connection.query(
        `SELECT *
         FROM gi_transactions
         WHERE gi_account_id = ?
         ORDER BY transaction_date ASC, id ASC`,
        [account.id]
    );

    let principal = Number(account.principal);

    let outstandingInterest = 0;

    // Date from which principal interest calculation starts.
    let principalStartDate = toDateOnly(account.gi_date);

    // Interest already accrued during the current principal period.
    let accruedInterestSoFar = 0;

    for (const transaction of transactions) {

        if (transaction.transaction_type === "DISBURSEMENT") {
            continue;
        }

        const transactionDate = toDateOnly(
            transaction.transaction_date
        );

        // Calculate cumulative interest on current principal.
        const cumulativeInterest = calculateGIInterest(
            principal,
            account.interest_rate,
            principalStartDate,
            transactionDate
        ).interest;

        // Add only newly accrued interest.
        const newInterest = Math.max(
            0,
            cumulativeInterest - accruedInterestSoFar
        );

        outstandingInterest += newInterest;

        accruedInterestSoFar = cumulativeInterest;

        // Deduct interest payment.
        const interestPaid = Number(
            transaction.interest_paid || 0
        );

        outstandingInterest = Math.max(
            0,
            outstandingInterest - interestPaid
        );

        // Deduct principal payment.
        const principalPaid = Number(
            transaction.principal_paid || 0
        );

        principal = Math.max(
            0,
            Number((principal - principalPaid).toFixed(2))
        );

        // If principal changes, start a new interest calculation period.
        if (principalPaid > 0) {

            principalStartDate = transactionDate;

            accruedInterestSoFar = 0;
        }
    }

    // Calculate interest up to requested date.
    const finalDate = toDateOnly(asOfDate);

    const finalCumulativeInterest = calculateGIInterest(
        principal,
        account.interest_rate,
        principalStartDate,
        finalDate
    ).interest;

    const remainingAccruedInterest = Math.max(
        0,
        finalCumulativeInterest - accruedInterestSoFar
    );

    outstandingInterest += remainingAccruedInterest;

    outstandingInterest = Number(
        outstandingInterest.toFixed(2)
    );

    principal = Number(principal.toFixed(2));

    return {
        principal,
        interest: outstandingInterest,
        totalDue: Number(
            (principal + outstandingInterest).toFixed(2)
        )
    };
};


// ==========================================
// EXPORT FUNCTIONS
// ==========================================

module.exports = {
    generateGINumber,
    calculateGIInterest,
    calculateGIBalance
};