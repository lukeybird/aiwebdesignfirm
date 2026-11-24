export const rewards = [
  {
    threshold: 1,
    rank: "Scout",
    name: "Listing photo field checklist",
    file: "listing-photo-checklist.txt",
    type: "text/plain",
    content: `PixaShop | Listing photo field checklist

Before shooting
[ ] Walk the property and choose the feature guests ask about most.
[ ] Clear supplies, personal items, family photos, and paperwork from view.
[ ] Clean the lens. Open curtains and compare the room with lights on and off.
[ ] Stand where a guest could actually stand. Keep the camera level.

At your Mac
[ ] Save a working copy of the original.
[ ] Straighten a doorframe or wall edge. Check verticals at both sides.
[ ] Lift shadows just enough to show detail; keep window highlights believable.
[ ] Compare against the original. Keep finishes and room proportions accurate.
[ ] Check the export at thumbnail size. Can you identify the main feature?
[ ] Reopen the exported file and archive the original alongside it.
`,
  },
  {
    threshold: 3,
    rank: "Guide",
    name: "Room-by-room shoot planner",
    file: "room-shoot-planner.csv",
    type: "text/csv",
    content:
      "Room or space,Guest question,Shot to capture,Best light,Original filename,Export filename,Status\r\nLiving room,How many people can sit together?,Show seating and surrounding space,,,,To shoot\r\nBedroom,Where is the bed in relation to the windows?,Show bed and natural light,,,,To shoot\r\nKitchen,Can we cook a full meal?,Show worktop and appliances,,,,To shoot\r\nEntrance,How do we get inside?,Show approach without exposing door codes,,,,To shoot\r\nOutdoor area,Is this space private?,Show boundaries and furniture,,,,To shoot\r\n",
  },
  {
    threshold: 10,
    rank: "Ambassador",
    name: "Cover photo experiment tracker",
    file: "cover-photo-experiments.csv",
    type: "text/csv",
    content:
      "Listing,Start date,End date,Cover image,What changed,Impressions,Listing views,Bookings,Other changes,Decision\r\nExample listing,,,Original cover,Baseline only,,,,Record pricing and availability changes,\r\nExample listing,,,Alternate cover,Crop around main feature,,,,Use a comparable period,\r\n",
  },
] as const;
