import React from "react";

function RegisterPatient() {
  return (
    <div>
      <h1>Register Patient</h1>

      <input type="text" placeholder="Patient Name" />
      <br /><br />

      <input type="number" placeholder="Age" />
      <br /><br />

      <button>Register</button>
    </div>
  );
}

export default RegisterPatient;