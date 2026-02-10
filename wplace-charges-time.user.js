// ==UserScript==
// @name         max charges time
// @namespace    https://github.com/mechanikate/wplace-charges-time
// @version      1.3.0
// @description  adds a timer counting down to when you will have max charges above the Paint button for wplace
// @license      MIT
// @author       mechanikate
// @updateURL    https://github.com/mechanikate/wplace-charges-time/releases/latest/download/wplace-charges-time.user.js
// @downloadURL  https://github.com/mechanikate/wplace-charges-time/releases/latest/download/wplace-charges-time.user.js
// @match        https://wplace.live/*
// @match        https://*.wplace.live/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_unregisterMenuCommand
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @noframes     true
// @grant unsafeWindow
// ==/UserScript==

// be warned, this code is really, really bad. whatever!
let charges = 0;
let maxCharges = 35;
let chargesFullColoring = GM_getValue("color", true); // default coloring to true
let showMax = GM_getValue("showmax", false); // don't show time until max charges by default
let coloringId, maxId;
let updateQueued = false; // stopper to make sure we don't run like 20 charge data fetch requests at once
const replaceNaN = (val, replacement) => isNaN(val) || val == null || val == undefined ? replacement : val;
const valueMissing = (val, isNodeList=false) => typeof(val) == "undefined" || val == null || (isNodeList && val.length == 0);
const rgbToHex = (r,g,b) => "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1); // from https://stackoverflow.com/a/5624139
const toHHMMSS = seconds => `${Math.floor(seconds/3600)}:${(Math.floor(seconds/60)%60).toString().padStart(2,"0")}:${(seconds%60).toString().padStart(2,"0")}`; // convert seconds to HH:MM:SS
const determineColor = fractionDone => rgbToHex(255*(1-fractionDone), 255*fractionDone, 0);
function updateToggles() {
    if(coloringId) GM_unregisterMenuCommand(coloringId);
    if(maxId) GM_unregisterMenuCommand(maxId);
    const coloringLabel = chargesFullColoring ? "Disable coloring" : "Enable coloring";
    const maxLabel = showMax ? "Hide time till max" : "Show time till max";
    coloringId = GM_registerMenuCommand(coloringLabel, () => { // on toggling
        chargesFullColoring = !chargesFullColoring;
        GM_setValue("color", chargesFullColoring);
        updateToggles();
    });
    maxId = GM_registerMenuCommand(maxLabel, () => { // on toggling
        showMax = !showMax;
        GM_setValue("showmax", showMax);
        updateToggles();
    });
}
unsafeWindow.updateChargeData=()=>{
    if(updateQueued) return console.log("(max charges time) Charge data update queued, not running again for now");
    updateQueued = true;
    console.log("(max charges time) Updating charge data...");
    window.fetch("https://backend.wplace.live/me", {credentials: 'include'}).then(response => {
        if (!response.ok) throw new Error("(max charges time) can't get charges and max charges");
        return response.json();
    }).then(json => {
        charges = Math.floor(json.charges.count);
        maxCharges = json.charges.max;
        updateQueued = false;
        console.log("(max charges time) Charge data successfully updated");
    });
};
setInterval(() => { // just an interval because I don't feel like making this more complex
    let plainChargeNode = document.querySelector(".btn.btn-primary.btn-lg>.flex.items-center>.flex.items-center>span>.w-7.text-xs");
    let dropletShopNodes = document.querySelectorAll(".btn.btn-xl.btn-primary.relative.mt-3.h-10");
    if(valueMissing(dropletShopNodes, true) && !updateQueued) {
        try { [0,1].forEach(i => dropletShopNodes[i].addEventListener("click", ()=>setTimeout(unsafeWindow.updateChargeData, 3500))); } catch {} // "+5 Max. Charges" and "+30 Charges" buttons;
    }
    if(valueMissing(plainChargeNode)) { // buttons missing/null? if so, add the event listeners in 3500ms:
        try { document.querySelector(".absolute.bottom-0 > .btn.btn-primary").addEventListener("click", ()=>setTimeout(unsafeWindow.updateChargeData, 3500)); return; } catch {} // the timeout is a really bad solution to waiting for loading. wtv
    }
    let plainChargeHTML = plainChargeNode.innerHTML;
    let secondsLeftForCharge = replaceNaN(parseInt(plainChargeHTML.match(/0:([0-9]+)/)[1]), 0); // get the # of seconds left (0-30) until we get 1 more charge
    let remainingSeconds = (maxCharges-charges)*30+secondsLeftForCharge;
    let maxSeconds = maxCharges*30;
    let existingEles = [document.getElementById("timeTillMaxCharges"), document.getElementById("timeTillMaxChargesOpen")];
    let toMaxStr = `(${toHHMMSS(remainingSeconds)}${showMax ? "/"+toHHMMSS(maxSeconds) : ""} to max)`;
    // if ele doesn't exist, set it up:
    let newSpans = [document.createElement("p"), document.createElement("p")];
    newSpans.forEach((newSpan,i) => {
        newSpan.classList.add("w-7", "text-xs");
        newSpan.innerHTML = toMaxStr;
        newSpan.id = ["timeTillMaxCharges","timeTillMaxChargesOpen"][i];
        newSpan.style.width = "100%";
        newSpan.style.paddingBottom = "10px";
        newSpan.style.textAlign = "center";
         if(chargesFullColoring) newSpan.style.color = determineColor(remainingSeconds/maxCharges/30);
    });
    const parentNodes = [document.querySelector(".btn.btn-primary.btn-lg.relative.z-30"), document.querySelector(".absolute.bottom-0.left-0.z-50.w-full > .rounded-t-box.bg-base-100.border-base-300.w-full.border-t.py-3 > .relative.px-3 > .mt-3.mb-4")];
    existingEles.forEach((existingEle,i) => {
        console.log(existingEle);
        if(typeof(existingEle) == "undefined" || existingEle == null) {
            if(parentNodes[i] === null) return;
            return parentNodes[i].parentElement.insertBefore(newSpans[i], parentNodes[i]);
        }
        existingEle.innerHTML = toMaxStr; // handle if our element alr exists
        if(chargesFullColoring) existingEle.style.color = determineColor(remainingSeconds/maxCharges/30);
        return false;
    });
}, 75);
window.setInterval(unsafeWindow.updateChargeData, 600000); // just to be safe, update charge data every 10 mins too
unsafeWindow.updateChargeData();
updateToggles();
