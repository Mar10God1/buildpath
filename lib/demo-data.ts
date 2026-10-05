export const navItems = [
  "Overview",
  "Timeline",
  "Ask BuildPath",
  "People & Companies",
  "Documents",
  "Costs",
  "Schedule",
  "Project Data",
];

export const project = {
  name: "Riverside Medical Office",
  location: "Austin, TX",
  status: "At Risk",
  completion: 62,
  originalFinish: "Feb 12, 2027",
  forecastFinish: "Mar 1, 2027",
  budget: "$12.4M",
  forecast: "$12.9M",
};

export const attention = [
  { title: "Framing is 14 days behind", detail: "Weather + late steel release + field rework", impact: "+$186k forecast" },
  { title: "Change Order 017 awaiting approval", detail: "Electrical service redesign", impact: "8 days exposed" },
  { title: "Three commitments due this week", detail: "Owner, MEP engineer, glazing subcontractor", impact: "Needs follow-up" },
];

export const events = [
  { date: "Sep 08", type: "Schedule", title: "Framing baseline start", detail: "Original CPM schedule" },
  { date: "Sep 10–12", type: "Weather", title: "Heavy rain / site access restricted", detail: "3 working days affected" },
  { date: "Sep 16", type: "Email", title: "Steel release conflict raised", detail: "PM ↔ fabricator correspondence" },
  { date: "Sep 21", type: "Change", title: "CO-017 design revision", detail: "Electrical room reroute" },
  { date: "Sep 26", type: "Field", title: "Rework identified", detail: "Wall layout conflict on Level 2" },
  { date: "Oct 05", type: "Forecast", title: "Framing now 14 days late", detail: "Critical path exposure identified" },
];
