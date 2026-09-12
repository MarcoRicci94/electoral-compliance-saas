export type MandataryAppointmentDocument = {
  templateCode: "MANDATARY_APPOINTMENT";
  status: "READY_FOR_GENERATION" | "DATA_INCOMPLETE";
  fields: Record<string, string>;
};

export function prepareAppointmentDocument(input: {
  candidateName: string;
  mandataryName: string;
  appointmentDate?: Date;
  mandataryTaxCode?: string;
}): MandataryAppointmentDocument {
  if (!input.appointmentDate || !input.mandataryTaxCode)
    return { templateCode: "MANDATARY_APPOINTMENT", status: "DATA_INCOMPLETE", fields: {} };
  return {
    templateCode: "MANDATARY_APPOINTMENT",
    status: "READY_FOR_GENERATION",
    fields: {
      candidateName: input.candidateName,
      mandataryName: input.mandataryName,
      mandataryTaxCode: input.mandataryTaxCode,
      appointmentDate: input.appointmentDate.toISOString().slice(0, 10)
    }
  };
}
