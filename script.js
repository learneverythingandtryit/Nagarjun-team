fetch('leaves.json')
  .then(response => response.json())
  .then(leaves => {
    const tbody = document.querySelector('#leaves-table tbody');
    leaves.sort((a, b) => new Date(a.from) - new Date(b.from));
    leaves.forEach(leave => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${leave.name}</td>
        <td>${leave.from}</td>
        <td>${leave.to}</td>
        <td>${leave.reason}</td>
      `;
      tbody.appendChild(tr);
    });
  })
  .catch(() => {
    document.querySelector('#leaves-table tbody').innerHTML =
      '<tr><td colspan="4">Could not load leaves.</td></tr>';
  });
