/* ===================================
   Thirdfort Check Manager - Demo/Testing
   =================================== */

/**
 * Mock client data for testing
 */
const mockClientData = {
  clientNumber: '50',
  matterNumber: '52',
  clientName: 'Mr J R Archer-Moran',
  feInitials: 'BA',
  firstName: 'Jacob',
  lastName: 'Archer-Moran',
  middleName: 'Robert',
  email: 'jacob@example.com',
  phoneNumber: '07123456789',
  title: 'Mr',
  hasAddressID: true,
  hasPhotoID: true,
  likenessConfirmed: true
};

/**
 * Send mock data to iframe (simulates parent window)
 */
function sendMockData() {
  const iframe = document.querySelector('iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'CLIENT_DATA',
      payload: mockClientData
    }, '*');
    console.log('Sent mock client data to iframe');
  }
}

/**
 * Auto-send mock data when iframe loads
 */
window.addEventListener('DOMContentLoaded', () => {
  const iframe = document.querySelector('iframe');
  if (iframe) {
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        sendMockData();
      }, 500);
    });
  }
});

/**
 * Listen for messages from iframe
 */
window.addEventListener('message', (event) => {
  console.log('Parent received message:', event.data);
  
  if (event.data.type === 'THIRDFORT_CHECK_READY') {
    console.log('Iframe is ready, sending mock data...');
    setTimeout(() => {
      sendMockData();
    }, 100);
  }
  
  if (event.data.type === 'THIRDFORT_CHECK_SUBMIT') {
    console.log('Check submission received:');
    console.log(JSON.stringify(event.data.payload, null, 2));
    alert('Check initiated successfully! See console for full data.');
  }
});

