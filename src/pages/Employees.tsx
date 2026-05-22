import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';

interface Employee {
  id: number;
  full_name: string;
  role: string;
}

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    api.users.getAll()
      .then(users => {
        const emps = users.map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          role: u.role
        }));
        setEmployees(emps);
      })
      .catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Employees</h1>
      <ul className="bg-white rounded shadow p-4">
        {employees.map(emp => (
          <li key={emp.id} className="mb-2">
            {emp.name} - {emp.role}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Employees;