module.exports = {
  ci: {
    collect: {
      // Ejecutar auditorías para desktop y mobile por separado (reportes en subcarpetas)
      /*Ejemplo de urls: 
       ['https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-management/employee-stock-options-tax-impacts',
       'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-management']
      */
      formFactors: ['desktop', 'mobile'],
      url: [
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/llc-formation-by-state/north-carolina/business-names/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/start-an-llc-w-2-employment/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-management/dba/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/bizee-dashboard/',  
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/new-york-llc/fees-filing-requirements/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/business-formation/virtual-address/personal/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/ideas/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/what-is-registered-agent/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/quarterly-taxes-llc/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/best-state-form-your-investment-real-estate-llc/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/help-center/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/get-bizee-podcast/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/bizee-basic-package/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-formation/start-business-under-500/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-formation/freelancers-creatives-ceo-freelancers/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/business-management/virtual-mailbox/wyoming/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/need-shopify-business-license/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-management/advertising-tax-deductions/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-formation/create-elevator-pitch-using-ai/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-management/tax-implications-hiring-contractors-vs-employees/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-management/how-to-pay-contractors-legally/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/ideas/top-10-reasons-to-start-a-business-today/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-management/protect-your-intellectual-property/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/articles/business-formation/healthcare-startups/',
        'https://bizeecom-feat-ga-111-fix-acce-qadqfr.laravel.cloud/llc-formation-by-state/california/doing-business-in-ca/',
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
