const fs = require('fs');

const prevCode = fs.readFileSync('e:/asistenq/prev_app.txt', 'utf8');
const currentCode = fs.readFileSync('e:/asistenq/src/ui/App.tsx', 'utf8');

const startTag = 'function LandingManager(';
const endTag = 'function DeployPanel(';

const startIndex = prevCode.indexOf(startTag);
// Actually wait, LandingManager ended right before AdminMemberPanel in the old code?
// Let's find exactly where LandingManager ends.
// In the old code, AdminMemberPanel comes after LandingManager.
const endOfLandingManager = prevCode.indexOf('function AdminMemberPanel(');

if (startIndex === -1 || endOfLandingManager === -1) {
  console.error("Could not find LandingManager in prev_app.txt");
  process.exit(1);
}

const landingManagerCode = prevCode.substring(startIndex, endOfLandingManager);

// Now insert it before AdminMemberPanel in currentCode
const currentMemberPanelIndex = currentCode.indexOf('function AdminMemberPanel(');
if (currentMemberPanelIndex === -1) {
  console.error("Could not find AdminMemberPanel in currentCode");
  process.exit(1);
}

const finalCode = currentCode.substring(0, currentMemberPanelIndex) + landingManagerCode + currentCode.substring(currentMemberPanelIndex);
fs.writeFileSync('e:/asistenq/src/ui/App.tsx', finalCode);
console.log("Restored LandingManager successfully.");
