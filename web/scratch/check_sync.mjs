import { ConvexHttpClient } from 'convex/browser';

const url = 'https://majestic-axolotl-627.convex.cloud';
const client = new ConvexHttpClient(url);

async function main() {
    console.log("Starting Final Deep Audit...");
    try {
        // 1. Kiểm tra danh sách người dùng từ hàm debug mới
        console.log("\n--- User Accounts (Debug) ---");
        let users = [];
        try {
            users = await client.query("debug:getAllUsers");
        } catch (e) {
            console.log("Failed to call debug:getAllUsers:", e.message);
        }
        
        if (users.length === 0) {
            console.log("No users found in database.");
        } else {
            users.forEach(u => {
                console.log(`User: ${u.name} | ID: ${u._id}`);
            });
        }

        // 2. Kiểm tra lại danh sách Merchant
        console.log("\n--- Merchant Records ---");
        const merchants = await client.query("merchants:list");
        if (!merchants || merchants.length === 0) {
            console.log("No merchants found.");
        } else {
            merchants.forEach(m => {
                console.log(`Store: ${m.shop_name} | Domain: ${m.shop_domain}`);
                console.log(`- ID: ${m._id}`);
                console.log(`- Owner ID field: "${m.owner_user_id}"`);
                console.log(`- Last Sync: ${m.last_sync_at ? new Date(m.last_sync_at).toLocaleString() : 'Never'}`);
                console.log("------------------------------");
            });
        }
    } catch (err) {
        console.error("Audit failed:", err.message);
    }
}

main();
