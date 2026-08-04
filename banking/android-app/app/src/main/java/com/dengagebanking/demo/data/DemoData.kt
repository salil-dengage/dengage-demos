package com.dengagebanking.demo.data

import java.util.Calendar
import java.util.Date

/* The same demo customer as banking/js/portalData.js, so a prospect who sees
   the web portal and then the app sees one person, not two. The figures are
   deliberately identical: the current account sits below 500 so the low
   balance trigger has something to fire on, and the Holiday goal is fully
   funded so the goal-reached trigger is reachable rather than theoretical. */

data class Account(
    val id: String, val name: String, val masked: String, val type: String,
    val balance: Double, val available: Double,
    val overdraftLimit: Double? = null, val overdraftUsed: Double? = null,
    val creditLimit: Double? = null
)

data class Txn(
    val id: String, val account: String, val payee: String, val amount: Double,
    val direction: String, val category: String, val recurring: Boolean = false,
    val salary: Boolean = false, val foreign: Boolean = false, val country: String? = null
)

data class Card(
    val id: String, val type: String, val lastFour: String,
    val frozen: Boolean = false, val limit: Double? = null
)

data class Mandate(val id: String, val payee: String, val amount: Double, val kind: String)

data class Goal(val name: String, val target: Double, val saved: Double)

data class Holding(val name: String, val assetClass: String, val weight: Int)

data class BankProduct(
    val id: String, val name: String, val categoryPath: String,
    val rateDisplay: String, val headlineRate: Double?, val rateType: String,
    val termMonths: Int?, val summary: String
)

object DemoData {

    const val ADVISER = "R. Mehta"
    const val PORTFOLIO_ID = "PF-4471"
    const val PORTFOLIO_VALUE_BAND = "250000_500000"
    const val RISK_PROFILE = "balanced"
    const val PERFORMANCE_BAND = "up_5_10"

    val ACCOUNTS = listOf(
        Account("acc-current", "Everyday Current Account", "****4471", "current_account",
            412.86, 912.86, overdraftLimit = 500.0, overdraftUsed = 0.0),
        Account("acc-saver", "Easy Access Saver", "****9920", "savings", 18450.00, 18450.00),
        Account("acc-isa", "Cash ISA", "****3312", "isa", 12750.00, 12750.00),
        Account("acc-card", "Meridian Platinum Card", "****8820", "credit_card",
            -842.30, 2157.70, creditLimit = 3000.0)
    )

    val TRANSACTIONS = listOf(
        Txn("txn-1", "****4471", "Meridian Payroll", 3120.00, "credit", "salary", salary = true),
        Txn("txn-2", "****8820", "Le Petit Marché", 48.20, "debit", "groceries",
            foreign = true, country = "FR"),
        Txn("txn-3", "****4471", "Trainline", 48.40, "debit", "travel"),
        Txn("txn-4", "****4471", "Streamly", 12.99, "debit", "subscriptions", recurring = true),
        Txn("txn-5", "****4471", "FitPass Gym", 39.00, "debit", "subscriptions", recurring = true),
        Txn("txn-6", "****4471", "Cloud Storage Plus", 8.99, "debit", "subscriptions", recurring = true),
        Txn("txn-7", "****4471", "Borough Energy", 96.40, "debit", "utilities", recurring = true)
    )

    val CARDS = listOf(
        Card("card-debit", "debit", "4471"),
        Card("card-credit", "credit", "8820", limit = 3000.0)
    )

    val MANDATES = listOf(
        Mandate("dd-1", "Northgate Mortgage", 1180.00, "direct_debit"),
        Mandate("dd-2", "Borough Energy", 96.40, "direct_debit"),
        Mandate("dd-3", "Council Tax", 168.00, "direct_debit"),
        Mandate("so-1", "Savings sweep", 250.00, "standing_order")
    )

    /* Fully funded on purpose. At 95% the creative claiming "goal reached"
       would be contradicting the data on screen. */
    val GOALS = listOf(
        Goal("Deposit", 42000.0, 18450.0),
        Goal("Holiday", 2500.0, 2500.0)
    )

    val HOLDINGS = listOf(
        Holding("Global Sustainable Fund", "equity", 42),
        Holding("UK Gilts Short Duration", "fixed_income", 28),
        Holding("Global Property Trust", "property", 14),
        Holding("Emerging Markets Equity", "equity", 11),
        Holding("Cash and equivalents", "cash", 5)
    )

    val PRODUCTS = listOf(
        BankProduct("mrt-first-home", "First Home Fixed", "Products > Mortgages > First home",
            "4.29% fixed", 4.29, "fixed", 60, "Five year fix with a 5% deposit."),
        BankProduct("sav-easy-access", "Easy Access Saver", "Products > Savings > Easy access",
            "4.10% AER", 4.10, "variable", null, "No notice, no penalty."),
        BankProduct("isa-cash", "Cash ISA", "Products > Savings > ISA",
            "4.05% AER", 4.05, "variable", null, "Tax free within your annual allowance."),
        BankProduct("crd-platinum", "Platinum Credit Card", "Products > Cards > Credit",
            "21.9% APR", 21.9, "representative", null, "No foreign transaction fee."),
        BankProduct("lon-personal", "Personal Loan", "Products > Borrowing > Loans",
            "6.9% APR", 6.9, "representative", 60, "Representative on 7,500 to 25,000.")
    )

    fun accountByMask(mask: String): Account? = ACCOUNTS.firstOrNull { it.masked == mask }

    /* Bands, not exact figures, because that is what a bank reports against
       and what a segment can actually be built on. */
    fun balanceBand(v: Double): String = when {
        v < 0 -> "overdrawn"
        v < 500 -> "under_500"
        v < 2000 -> "500_2000"
        v < 10000 -> "2000_10000"
        v < 50000 -> "10000_50000"
        else -> "over_50000"
    }

    fun daysFromNow(days: Int): Date = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_MONTH, days)
    }.time

    val subscriptions get() = TRANSACTIONS.filter { it.recurring && it.category == "subscriptions" }
    val salaryTxn get() = TRANSACTIONS.firstOrNull { it.salary }
    val foreignTxn get() = TRANSACTIONS.firstOrNull { it.foreign }
    val currentAccount get() = ACCOUNTS.first()
    val metGoal get() = GOALS.firstOrNull { it.saved >= it.target }
}
