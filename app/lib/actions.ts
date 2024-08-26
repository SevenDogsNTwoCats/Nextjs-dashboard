'use server' // todas las acciones de este archivo son de servidor, el codigo no se ejecuta ni se envia al cleinte
import { date, z } from 'zod'
import { Invoice } from './definitions'
import { sql } from '@vercel/postgres'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const InvoiceFormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
        .number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
})

const InvoiceSchema = InvoiceFormSchema.omit({
    id: true,
    date: true
})

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    // aqui se guardaria la factura en la base de datos
    // const rawFormData = Object.fromEntries(formData.entries())
    const validatedFields = InvoiceSchema.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountString = amount * 100 //para evitar problemas con los decimales/redondeo
    const [date] = new Date().toISOString().split('T') // 2024-08-25


    try {
        await sql`INSERT INTO invoices (customer_id, amount, status, date) 
        VALUES (${customerId}, ${amountString}, ${status}, ${date})`
    } catch (error) {
        return { message: 'Database Error: Failed to Create Invoice.', }
    }

    revalidatePath('/dashboard/invoices') // invalida la cache de la pagina de facturas
    redirect('/dashboard/invoices') // redirige a la pagina de facturas
}

export const updateInvoice = async (
    id: string,
    prevState: State,
    formData: FormData,) => {

    const validatedFields = InvoiceSchema.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;

    const amountString = amount * 100

    try {
        await sql`UPDATE invoices SET customer_id = ${customerId}, amount = ${amountString}, status = ${status} WHERE id = ${id}`

    } catch (error) {
        return { message: 'Database Error: Failed to Update Invoice.', }
    }
    revalidatePath('/dashboard/invoices') // invalida la cache de la pagina de facturas
    redirect('/dashboard/invoices') // redirige a la pagina de facturas
}

export const deleteInvoice = async (id: string) => {
    // throw new Error('Failed to Delete Invoice');
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`
        revalidatePath('/dashboard/invoices') // invalida la cache de la pagina de facturas
        return { message: 'Invoice Deleted Successfully.', }
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Invoice.', }
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

