const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const SET_LOG_ID = process.env.NOTION_DATA_SOURCE_ID_SET_LOG;
const HABIT_TRACKER_ID = process.env.NOTION_DATA_SOURCE_ID_HABIT_TRACKER;

async function processWorkoutSets() {
    try {
        // 1. Fetch uncounted sets from the Set Log
        console.log("Searching for uncounted sets...");
        const uncountedResponse = await notion.dataSources.query({
            data_source_id: SET_LOG_ID,
            filter: {
                property: "Counted",
                checkbox: { equals: false }
            }
        });

        const newSets = uncountedResponse.results;
        const newSetsCount = newSets.length;

        if (newSetsCount === 0) {
            console.log("No new sets to count. Exiting.");
            return;
        }

        console.log(`Found ${newSetsCount} new set(s) to process.`);

        // 2. Determine today's date in IST (Asia/Kolkata)
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);
        const todayStr = istDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        
        console.log(`Looking for Habit Tracker row for Date: ${todayStr}`);

        // 3. Find today's row in the Habit Tracker
        const habitTrackerResponse = await notion.dataSources.query({
            data_source_id: HABIT_TRACKER_ID,
            filter: {
                property: "Date",
                date: { equals: todayStr }
            }
        });

        if (habitTrackerResponse.results.length === 0) {
            console.error("Error: Could not find today's row in the Habit Tracker. Did Make.com run today?");
            return;
        }

        const todayRow = habitTrackerResponse.results[0];
        const currentCount = todayRow.properties["💪🔢"].number || 0;
        const updatedCount = currentCount + newSetsCount;

        // 4. Update the Habit Tracker count
        console.log(`Updating Habit Tracker: ${currentCount} -> ${updatedCount}`);
        await notion.pages.update({
            page_id: todayRow.id,
            properties: {
                "💪🔢": { number: updatedCount }
            }
        });

        // 5. Mark the processed sets as "Counted"
        console.log("Marking sets as Counted...");
        for (const set of newSets) {
            await notion.pages.update({
                page_id: set.id,
                properties: {
                    "Counted": { checkbox: true }
                }
            });
        }

        console.log("Workout sync complete!");

    } catch (error) {
        console.error("An error occurred during execution:", error.body || error);
    }
}

processWorkoutSets();