-- Fix the settlement trigger to properly update both paid_amount and balance_amount
CREATE OR REPLACE FUNCTION public.update_transaction_paid_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Update both paid amount and balance amount in transactions table
    UPDATE transactions 
    SET 
        paid_amount = COALESCE((
            SELECT SUM(amount) 
            FROM payment_settlements 
            WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
        ), 0),
        balance_amount = amount - COALESCE((
            SELECT SUM(amount) 
            FROM payment_settlements 
            WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
        ), 0)
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;
