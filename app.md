I have given some money to my friend. I need to keep track of the money, the interest rate (calculated daily, compounded monthly), and the current balance.

Basically,
- I need to add/remove money from the balance at any date
- I need to calculate the interest accured on the balance to date
- The interest is compounded monthly, so at the end of each month, the interest accrued is added to the balance. The interest rate is calculated on a daily basis.
- The interest rate can be changed at any date, and the new interest rate will apply from that date onwards.
- I need to be able to see the balance at any given date, including the interest accrued
- I need to be able to see a history of all transactions (add/remove money, interest rate changes, interest accruals) with their dates.
- I need to be able to export this data to a CSV file for record-keeping.

This will be a very simple application, built on next.js with a simple UI to input transactions and view the balance/history. No authentication or user management is needed, as this is just for personal use. I will host it locally or on a simple hosting service.

Also, I want to use a simple database like SQLite to store the data. I will host the sqlite data on [turso.tech](https://docs.turso.tech/introduction).

Here is a simple outline of how you can implement this application using Next.js and SQLite:
1. **Set up the Next.js project**:
   - Create a new Next.js project using `npx create-next-app money-tracker`.
   - Install necessary dependencies like `sqlite3` for database interaction and `csv-writer` for exporting CSV files.
   - Set up SQLite database connection using Turso.
   - Create database schema to store transactions, interest rates, and balance history.
   - Create API routes to handle CRUD operations for transactions and interest rates.
   - Implement logic to calculate interest accrued based on the daily interest rate and compound it monthly.
   - Create frontend components to input transactions, view balance, and transaction history.
   - Implement CSV export functionality to download transaction history.
   - Test the application thoroughly to ensure all functionalities work as expected. You can create unit tests and integration tests for critical parts of the application.
   - Deploy the application on a local server or a simple hosting service that supports Next.js and SQLite.
   - Maintain and update the application as needed, adding new features or fixing bugs based on your usage.
   - Document the application, including setup instructions, usage guidelines, and any other relevant information for future reference.
   - Make sure that you are following best practices for security, performance, and code quality throughout the development process.
   - Consider using version control (e.g., Git) to manage your codebase and track changes over time.
