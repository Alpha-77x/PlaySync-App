/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "c77e484a8d765147bf7e5b7d0997ffe2"
  }, {
    "url": "pwa-512x512.png",
    "revision": "f822c8f2d761419ddc3d4b4015891783"
  }, {
    "url": "pwa-192x192.png",
    "revision": "2742233655ad8d26e61c699820a46341"
  }, {
    "url": "index.html",
    "revision": "0d999ab14f4b6f5a398c83bb24aced74"
  }, {
    "url": "icon.svg",
    "revision": "dd9f531094adff4e3c0ab5bfbeae2726"
  }, {
    "url": "favicon.png",
    "revision": "d55fe355b6d423a8854a024974314993"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "7721fb0ea899cd982b6be84d07b34cac"
  }, {
    "url": "assets/ui-DogRhVMI.js",
    "revision": null
  }, {
    "url": "assets/three-DlgHmEw2.js",
    "revision": null
  }, {
    "url": "assets/rolldown-runtime-WkwZ5CU-.js",
    "revision": null
  }, {
    "url": "assets/react-vendor-rKHIt0pA.js",
    "revision": null
  }, {
    "url": "assets/index-CxCazpUp.js",
    "revision": null
  }, {
    "url": "assets/index-Co3p0g4J.css",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "7721fb0ea899cd982b6be84d07b34cac"
  }, {
    "url": "favicon.png",
    "revision": "d55fe355b6d423a8854a024974314993"
  }, {
    "url": "pwa-192x192.png",
    "revision": "2742233655ad8d26e61c699820a46341"
  }, {
    "url": "pwa-512x512.png",
    "revision": "f822c8f2d761419ddc3d4b4015891783"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "c77e484a8d765147bf7e5b7d0997ffe2"
  }, {
    "url": "manifest.webmanifest",
    "revision": "1769811ca031bc5aa2f36ab7128e5b3d"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
