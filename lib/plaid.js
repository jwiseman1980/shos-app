import { PlaidApi, PlaidEnvironments, Configuration } from "plaid";

let _client;

export function getPlaidClient() {
  if (_client) return _client;
  const env = process.env.PLAID_ENV || "sandbox";
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  _client = new PlaidApi(config);
  return _client;
}
