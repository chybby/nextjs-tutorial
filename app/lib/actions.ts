'use server';

import { sql } from '@vercel/postgres';
import { signIn } from '@/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AuthError } from 'next-auth';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    required_error: 'Please select a customer.',
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    required_error: 'Please select an invoice status.',
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// This is temporary until @types/react-dom is updated
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  //   const rawFormData = {
  //     customerId: formData.get('customerId'),
  //     amount: formData.get('amount'),
  //     status: formData.get('status'),
  //   };

  const validatedFields = CreateInvoice.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Invalid fields. Failed to create an invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to create invoice.',
    };
  }

  // Clear the client-side cache for the invoices page since there is new data.
  revalidatePath('/dashboard/invoices');
  // Needs to be called outside a try/catch block as it throws an error.
  redirect('/dashboard/invoices');
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  const validatedFields = CreateInvoice.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Invalid fields. Failed to update invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to update invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`
      DELETE from invoices
      WHERE id = ${id}
    `;

    revalidatePath('/dashboard/invoices');
    return { message: 'Deleted Invoice.' };
  } catch (error) {
    return {
      message: 'Database Error: Failed to delete invoice.',
    };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
