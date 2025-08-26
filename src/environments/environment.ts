// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebaseConfig: {
    apiKey: "AIzaSyDUh-FE2d_29NqrGNXRuTcBDA7ceDaZyAo",
    authDomain: "adolepay.firebaseapp.com",
    projectId: "adolepay",
    storageBucket: "adolepay.appspot.com", // ✅ corrigido
    messagingSenderId: "191341536652",
    appId: "1:191341536652:web:88e6aa838fb4b4ebbda2a9",
    measurementId: "G-G9NP754FRS"
  }
};


/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
