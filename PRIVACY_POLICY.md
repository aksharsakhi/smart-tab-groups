# Privacy Policy for Smart Tab Groups

**Effective Date: July 12, 2026**

Smart Tab Groups ("the Extension") is committed to protecting your privacy. This Privacy Policy explains how the Extension handles information.

---

## 1. Information Collection and Transmission
The Extension operates **100% locally** on your device. 
* **No Data Collection**: The Extension does not collect, store on remote servers, transmit, or share any personal data, web browsing history, or user activity.
* **No External Communication**: The Extension does not communicate with any external servers or APIs. All operations are run entirely in your local browser sandbox.

## 2. Permissions Used
The Extension requests the following permissions solely to enable core features locally on your machine:
* **`tabs`**: Used to analyze active tabs, detect duplicate URLs, and close stale tabs as requested.
* **`tabGroups`**: Used to programmatically organize, name, and color-code your tabs into local groups.
* **`storage`**: Used to save your workspaces, custom domain rules, and inactivity threshold settings locally in your browser’s sandboxed database.

## 3. Data Storage
All configurations, saved workspaces, and tab activity metrics are stored locally on your device via Chrome’s sandboxed `chrome.storage.local` API. This data is deleted automatically if you uninstall the Extension.

## 4. Changes to This Policy
We may update this Privacy Policy from time to time. Any updates will be posted in this file within the extension repository.

## 5. Contact
If you have any questions about this Privacy Policy, please open an issue in the official project repository: https://github.com/aksharsakhi/smart-tab-groups.
