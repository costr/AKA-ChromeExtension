# AKA

This is a simple Chrome extension that allows you to modify text elements on loaded pages.

## Installation

1. Download or clone this repository to your local machine.
2. Open the Chrome browser and navigate to `chrome://extensions`.
3. Enable `Developer mode` by ticking the checkbox in the upper-right corner.
4. Click on the `Load unpacked extension` button.
5. Navigate to the directory where you downloaded or cloned this repository and click `OK`.

## Usage

After installation, you will see the extension's icon in the Chrome toolbar. Click on the icon to open the popup. The popup allows you to enable or disable the extension for the current tab.

You can also change the settings of the extension by clicking on the `Options` link in the popup. The options page allows you to customize the behavior of the extension.

The extension works by injecting a content script into the web pages. The content script has access to the DOM of the pages and can modify the HTML elements. The background script listens for events from the browser and communicates with the content script to perform tasks.

## Options

The options page allows you to customize the behavior of the extension. You can enable or disable the extension for specific websites, change the appearance of the modified HTML elements, and more.

## Support

If you encounter any problems or have any suggestions, please open an issue on the GitHub repository.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more information.