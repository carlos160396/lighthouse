module.exports = {
  ci: {
    collect: {
      // Ejecutar auditorías para desktop y mobile por separado (reportes en subcarpetas)
      /*Ejemplo de urls: 
       ['https://bizee.com/articles/business-management/employee-stock-options-tax-impacts',
       'https://bizee.com/articles/business-management']
      */
      formFactors: ['desktop', 'mobile'],
      url: [
        // 'https://bizee.com/',
    ],
      chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      settings: {
        onlyCategories: ['accessibility'],
        chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['warn', { minScore: 0.96 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lhci-reports',
    },
  },
};
